using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

/// <summary>
/// Time series per sensor, downsampled in PostgreSQL (date_bin). Every bucket of the window is returned; a bucket
/// without readings has count 0 and null values, so gaps stay gaps (prime directive 2: never interpolate or fill).
/// </summary>
public class ReadingsService(TileTwinDbContext db, TimeProvider clock)
{
    public static readonly IReadOnlyDictionary<string, (TimeSpan Span, TimeSpan Bucket)> Ranges = new Dictionary<string, (TimeSpan, TimeSpan)>
    {
        ["1h"] = (TimeSpan.FromHours(1), TimeSpan.FromMinutes(1)),  // not finer than the 1-minute seeded history
        ["24h"] = (TimeSpan.FromHours(24), TimeSpan.FromMinutes(5)),
        ["7d"] = (TimeSpan.FromDays(7), TimeSpan.FromMinutes(30)),
    };

    static readonly DateTime Origin = new(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    sealed record Bucket(string SensorId, DateTime T, double Avg, double Min, double Max, int Count);

    public async Task<ReadingsResponse?> GetAsync(string machineId, string range, CancellationToken ct)
    {
        if (!Ranges.TryGetValue(range, out var r)) throw new ArgumentException($"range must be one of {string.Join(", ", Ranges.Keys)}");
        var machine = await db.Machines.AsNoTracking().FirstOrDefaultAsync(m => m.Id == machineId, ct);
        if (machine is null) return null;

        var to = clock.GetUtcNow().UtcDateTime;
        var from = to - r.Span;
        var buckets = await db.Database.SqlQuery<Bucket>($"""
            SELECT "SensorId", date_bin({r.Bucket}, "TimestampUtc", {Origin}) AS "T",
                   avg("Value") AS "Avg", min("Value") AS "Min", max("Value") AS "Max", count(*)::int AS "Count"
            FROM "SensorReadings"
            WHERE "MachineId" = {machineId} AND "TimestampUtc" >= {from} AND "TimestampUtc" <= {to}
            GROUP BY 1, 2 ORDER BY 1, 2
            """).ToListAsync(ct);
        var bySensor = buckets.ToLookup(b => b.SensorId);
        var grid = new List<DateTime>();
        for (var t = Bin(from, r.Bucket); t <= to; t += r.Bucket) grid.Add(t);

        var sensors = await db.SensorDefinitions.AsNoTracking().Where(s => s.MachineId == machineId).OrderBy(s => s.Id).ToListAsync(ct);
        return new ReadingsResponse(machineId, range, from, to, (int)r.Bucket.TotalSeconds, machine.DataOrigin,
            sensors.Select(s =>
            {
                var have = bySensor[s.Id].ToDictionary(b => b.T);
                return new SensorSeriesDto(s.Id, s.Measurement, s.Unit, s.WarningMin, s.WarningMax, s.CriticalMin, s.CriticalMax,
                    grid.Select(t => have.TryGetValue(t, out var b)
                        ? new SeriesPoint(t, Math.Round(b.Avg, 3), b.Min, b.Max, b.Count)
                        : new SeriesPoint(t, null, null, null, 0)).ToList());
            }).ToList());
    }

    /// <summary>Same bucket start as PostgreSQL's date_bin(stride, t, Origin).</summary>
    static DateTime Bin(DateTime t, TimeSpan stride) => Origin + TimeSpan.FromTicks((t - Origin).Ticks / stride.Ticks * stride.Ticks);
}
