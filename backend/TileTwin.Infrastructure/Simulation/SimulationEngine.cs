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
    /// <summary>Serialises simulator ticks with "Reset demo data" so they never interleave.</summary>
    public static readonly SemaphoreSlim DemoLock = new(1, 1);
    static readonly Random Rng = new(); // ticks are sequential (one hosted service)

    static readonly Dictionary<string, (string MachineId, DemoPlant.SensorSpec Spec)> Specs =
        DemoPlant.Machines.SelectMany(m => m.Sensors.Select(s => (Key: DemoPlant.SensorId(m.Id, s.Suffix), Value: (m.Id, s))))
            .ToDictionary(x => x.Key, x => x.Value);

    public sealed record TickResult(int Written, bool Paused);

    /// <summary>None: live point only. SinceLast: fill a gap of more than 2 minutes after the latest reading
    /// (cheap, every tick). Holes: fill every missing minute of the last 7 days (startup, after PC sleep).</summary>
    public enum Backfill { None, SinceLast, Holes }

    /// <summary>One tick: a live reading per sensor, plus backfilled minutes at 1-minute resolution so ML windows stay complete.</summary>
    public async Task<TickResult> TickAsync(DateTime nowUtc, Backfill backfill, CancellationToken ct = default)
    {
        await DemoLock.WaitAsync(ct);
        try { return await TickCoreAsync(nowUtc, backfill, ct); }
        finally { DemoLock.Release(); }
    }

    async Task<TickResult> TickCoreAsync(DateTime nowUtc, Backfill backfill, CancellationToken ct)
    {
        var state = await db.DemoState.AsNoTracking().SingleOrDefaultAsync(ct);
        if (state is null) return new(0, false);
        if (state.SimulatorPaused) return new(0, true);

        var sensors = await db.SensorDefinitions.AsNoTracking()
            .Where(s => db.Machines.Any(m => m.Id == s.MachineId && !m.IsOffline))
            .OrderBy(s => s.Id).ToListAsync(ct);
        var live = sensors.Where(s => Specs.ContainsKey(s.Id) && SignalModel.HasLiveReading(s.MachineId, Specs[s.Id].Spec.Suffix)).ToList();
        if (live.Count == 0) return new(0, false);

        var times = backfill switch
        {
            Backfill.SinceLast => await SinceLastAsync(live[0].MachineId, live[0].Id, nowUtc, ct),
            Backfill.Holes => await HolesAsync(live[0].MachineId, live[0].Id, nowUtc, ct),
            _ => [nowUtc],
        };
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
        return new(rows.Count, false);
    }

    async Task<List<DateTime>> SinceLastAsync(string machineId, string sensorId, DateTime now, CancellationToken ct)
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

    /// <summary>Minutes of the last 7 days (after the seeded history starts) with no reading on the reference sensor.</summary>
    async Task<List<DateTime>> HolesAsync(string machineId, string sensorId, DateTime now, CancellationToken ct)
    {
        var from = now - MaxBackfill;
        var stamps = await db.SensorReadings.Where(r => r.MachineId == machineId && r.SensorId == sensorId && r.TimestampUtc >= from)
            .Select(r => r.TimestampUtc).ToListAsync(ct);
        if (stamps.Count == 0) return [now];
        var have = stamps.Select(Minute).ToHashSet();
        var times = new List<DateTime>();
        for (var t = Minute(stamps.Min()).AddMinutes(1); t < Minute(now); t = t.AddMinutes(1))
            if (!have.Contains(t)) times.Add(t);
        times.Add(now);
        return times;
    }

    static DateTime Minute(DateTime t) => new(t.Ticks - t.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);
}
