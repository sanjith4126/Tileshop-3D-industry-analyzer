using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

/// <summary>Time series per sensor, downsampled in PostgreSQL (date_bin) to a few hundred points.</summary>
public class ReadingsService(TileTwinDbContext db, TimeProvider clock)
{
    public static readonly IReadOnlyDictionary<string, (TimeSpan Span, TimeSpan Bucket)> Ranges = new Dictionary<string, (TimeSpan, TimeSpan)>
    {
        ["1h"] = (TimeSpan.FromHours(1), TimeSpan.FromSeconds(30)),
        ["24h"] = (TimeSpan.FromHours(24), TimeSpan.FromMinutes(5)),
        ["7d"] = (TimeSpan.FromDays(7), TimeSpan.FromMinutes(30)),
    };

    sealed record Bucket(string SensorId, DateTime T, double Avg, double Min, double Max);

    public async Task<ReadingsResponse?> GetAsync(string machineId, string range, CancellationToken ct)
    {
        if (!Ranges.TryGetValue(range, out var r)) throw new ArgumentException($"range must be one of {string.Join(", ", Ranges.Keys)}");
        var machine = await db.Machines.AsNoTracking().FirstOrDefaultAsync(m => m.Id == machineId, ct);
        if (machine is null) return null;

        var to = clock.GetUtcNow().UtcDateTime;
        var from = to - r.Span;
        var origin = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var buckets = await db.Database.SqlQuery<Bucket>($"""
            SELECT "SensorId", date_bin({r.Bucket}, "TimestampUtc", {origin}) AS "T",
                   avg("Value") AS "Avg", min("Value") AS "Min", max("Value") AS "Max"
            FROM "SensorReadings"
            WHERE "MachineId" = {machineId} AND "TimestampUtc" >= {from} AND "TimestampUtc" <= {to}
            GROUP BY 1, 2 ORDER BY 1, 2
            """).ToListAsync(ct);
        var bySensor = buckets.GroupBy(b => b.SensorId).ToDictionary(g => g.Key, g => g.ToList());

        var sensors = await db.SensorDefinitions.AsNoTracking().Where(s => s.MachineId == machineId).OrderBy(s => s.Id).ToListAsync(ct);
        return new ReadingsResponse(machineId, range, from, to, (int)r.Bucket.TotalSeconds, machine.DataOrigin,
            sensors.Select(s => new SensorSeriesDto(s.Id, s.Measurement, s.Unit, s.WarningMin, s.WarningMax, s.CriticalMin, s.CriticalMax,
                (bySensor.GetValueOrDefault(s.Id) ?? []).Select(b => new SeriesPoint(b.T, Math.Round(b.Avg, 3), b.Min, b.Max)).ToList())).ToList());
    }
}
