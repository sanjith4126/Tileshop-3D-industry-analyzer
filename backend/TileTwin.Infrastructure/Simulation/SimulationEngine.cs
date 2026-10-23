using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TileTwin.Domain;
using TileTwin.Domain.Alerts;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Seeding;

namespace TileTwin.Infrastructure.Simulation;

/// <summary>
/// Writes live synthetic readings (continuing the scripted patterns) and opens threshold alerts.
/// Machines flagged offline get no readings; the PUMP-002 flow sensor keeps its gap.
/// </summary>
public class SimulationEngine(TileTwinDbContext db, ILogger<SimulationEngine> log)
{
    public static readonly TimeSpan MaxBackfill = TimeSpan.FromDays(7);
    static readonly Random Rng = new(); // ticks are sequential (one hosted service)

    static readonly Dictionary<string, (string MachineId, DemoPlant.SensorSpec Spec)> Specs =
        DemoPlant.Machines.SelectMany(m => m.Sensors.Select(s => (Key: DemoPlant.SensorId(m.Id, s.Suffix), Value: (m.Id, s))))
            .ToDictionary(x => x.Key, x => x.Value);

    /// <summary>One tick. With <paramref name="backfill"/>, also fills the gap since the last reading at 1-minute resolution.</summary>
    public async Task<int> TickAsync(DateTime nowUtc, bool backfill, CancellationToken ct = default)
    {
        var state = await db.DemoState.AsNoTracking().SingleOrDefaultAsync(ct);
        if (state is null || state.SimulatorPaused) return 0;

        var sensors = await db.SensorDefinitions.AsNoTracking()
            .Where(s => db.Machines.Any(m => m.Id == s.MachineId && !m.IsOffline))
            .OrderBy(s => s.Id).ToListAsync(ct);
        var live = sensors.Where(s => Specs.ContainsKey(s.Id) && SignalModel.HasLiveReading(s.MachineId, Specs[s.Id].Spec.Suffix)).ToList();
        if (live.Count == 0) return 0;

        var times = backfill ? await BackfillTimesAsync(live[0].MachineId, live[0].Id, nowUtc, ct) : [nowUtc];
        var rows = times.SelectMany(t => live.Select(s =>
            new ReadingRow(s.MachineId, s.Id, SignalModel.Value(s.MachineId, Specs[s.Id].Spec, t, state.AnchorUtc, Rng), t))).ToList();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await ReadingWriter.CopyAsync(db, rows, ct);

        var open = await db.Alerts.Where(a => a.Status != AlertStatus.Resolved)
            .Select(a => new { a.MachineId, a.SensorId, a.Severity }).ToListAsync(ct);
        var alerts = ReadingWriter.DetectAlerts(rows,
            live.ToDictionary(s => s.Id, s => new SensorLimits(s.WarningMin, s.WarningMax, s.CriticalMin, s.CriticalMax)),
            new AlertDetector(open.Select(a => (a.MachineId, a.SensorId, a.Severity))),
            _ => Guid.NewGuid());
        db.Alerts.AddRange(alerts);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        db.ChangeTracker.Clear();

        foreach (var a in alerts)
            log.LogInformation("Alert opened: {Severity} {Sensor} = {Value} (limit {Threshold})", a.Severity, a.SensorId, a.ObservedValue, a.Threshold);
        if (times.Count > 1)
            log.LogInformation("Simulator backfilled {Minutes} minutes ({Rows} readings)", times.Count - 1, rows.Count);
        return rows.Count;
    }

    async Task<List<DateTime>> BackfillTimesAsync(string machineId, string sensorId, DateTime now, CancellationToken ct)
    {
        var last = await db.SensorReadings.Where(r => r.MachineId == machineId && r.SensorId == sensorId)
            .MaxAsync(r => (DateTime?)r.TimestampUtc, ct);
        var times = new List<DateTime>();
        if (last is { } l && now - l > TimeSpan.FromMinutes(2))
        {
            var start = l > now - MaxBackfill ? l : now - MaxBackfill;
            for (var t = start.AddMinutes(1); t < now; t = t.AddMinutes(1)) times.Add(t);
        }
        times.Add(now);
        return times;
    }
}
