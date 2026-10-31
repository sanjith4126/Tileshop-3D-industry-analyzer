using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TileTwin.Domain;
using TileTwin.Domain.Alerts;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Seeding;

namespace TileTwin.Infrastructure.Simulation;

/// <summary>
/// Writes live synthetic readings (continuing the scripted patterns) and opens threshold alerts.
/// Machines flagged offline get no readings; the PUMP-002 flow sensor keeps its gap. A tick writes the live point
/// only: time the simulator was not running (paused, stopped, PC asleep) stays a visible gap — it is never
/// back-filled (prime directive 2). History is generated only by the seeder ("Reset demo data").
/// </summary>
public class SimulationEngine(TileTwinDbContext db, ILogger<SimulationEngine> log)
{
    /// <summary>Serialises simulator ticks with "Reset demo data" so they never interleave.</summary>
    public static readonly SemaphoreSlim DemoLock = new(1, 1);
    static readonly Random Rng = new(); // ticks are sequential (one hosted service)

    static readonly Dictionary<string, (string MachineId, DemoPlant.SensorSpec Spec)> Specs =
        DemoPlant.Machines.SelectMany(m => m.Sensors.Select(s => (Key: DemoPlant.SensorId(m.Id, s.Suffix), Value: (m.Id, s))))
            .ToDictionary(x => x.Key, x => x.Value);

    public sealed record TickResult(int Written, bool Paused);

    /// <summary>One tick: a live reading per sensor at <paramref name="nowUtc"/>.</summary>
    public async Task<TickResult> TickAsync(DateTime nowUtc, CancellationToken ct = default)
    {
        await DemoLock.WaitAsync(ct);
        try { return await TickCoreAsync(nowUtc, ct); }
        finally { DemoLock.Release(); }
    }

    async Task<TickResult> TickCoreAsync(DateTime nowUtc, CancellationToken ct)
    {
        var state = await db.DemoState.AsNoTracking().SingleOrDefaultAsync(ct);
        if (state is null) return new(0, false);
        if (state.SimulatorPaused) return new(0, true);

        var sensors = await db.SensorDefinitions.AsNoTracking()
            .Where(s => db.Machines.Any(m => m.Id == s.MachineId && !m.IsOffline))
            .OrderBy(s => s.Id).ToListAsync(ct);
        var live = sensors.Where(s => Specs.ContainsKey(s.Id) && SignalModel.HasLiveReading(s.MachineId, Specs[s.Id].Spec.Suffix)).ToList();
        if (live.Count == 0) return new(0, false);

        var rows = live.Select(s =>
            new ReadingRow(s.MachineId, s.Id, SignalModel.Value(s.MachineId, Specs[s.Id].Spec, nowUtc, state.AnchorUtc, Rng), nowUtc)).ToList();

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
        return new(rows.Count, false);
    }
}
