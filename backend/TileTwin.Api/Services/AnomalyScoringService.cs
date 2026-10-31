using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

/// <summary>Last known ML service state (singleton, updated by every call).</summary>
public class MlStatus
{
    public bool Available { get; private set; }
    public string Message { get; private set; } = "Not checked yet";
    public DateTime? LastCheckedUtc { get; private set; }

    public void Set(bool available, string message)
    {
        Available = available;
        Message = message;
        LastCheckedUtc = DateTime.UtcNow;
    }
}

public sealed record ScoreOutcome(string MachineId, AnomalyScore? Score, bool Unavailable, string? Problem);

/// <summary>Sends the last 60 one-minute samples per sensor to the ML service and stores the result.</summary>
public class AnomalyScoringService(TileTwinDbContext db, MlClient ml, MlStatus status, TimeProvider clock)
{
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(60);
    public static readonly TimeSpan Fresh = TimeSpan.FromMinutes(15);

    sealed record Sample(string SensorId, DateTime Minute, double Value);

    public static string Suffix(string sensorId) => sensorId[(sensorId.LastIndexOf('-') + 1)..];

    public async Task<ScoreOutcome> ScoreAsync(string machineId, CancellationToken ct)
    {
        var machine = await db.Machines.AsNoTracking().FirstOrDefaultAsync(m => m.Id == machineId, ct);
        if (machine is null) return new(machineId, null, false, "Unknown machine");
        if (machine.IsOffline) return new(machineId, null, false, "Machine is flagged offline — not scored");

        var now = clock.GetUtcNow().UtcDateTime;
        var from = now - Window;
        // One sample per minute (the last reading in that minute) so live 5-second data matches the training resolution.
        var samples = await db.Database.SqlQuery<Sample>($"""
            SELECT DISTINCT ON ("SensorId", date_trunc('minute', "TimestampUtc"))
                   "SensorId", date_trunc('minute', "TimestampUtc") AS "Minute", "Value"
            FROM "SensorReadings"
            WHERE "MachineId" = {machineId} AND "TimestampUtc" > {from}
            ORDER BY "SensorId", date_trunc('minute', "TimestampUtc"), "TimestampUtc" DESC
            """).ToListAsync(ct);
        var readings = samples.GroupBy(s => Suffix(s.SensorId))
            .ToDictionary(g => g.Key, g => g.OrderBy(s => s.Minute).TakeLast(60).Select(s => s.Value).ToList());

        var res = await ml.PredictAsync(machineId, machine.MachineTypeId, readings, ct);
        status.Set(!res.Unavailable, res.Unavailable ? "ML service unavailable" : "ML service reachable");
        if (res.Value is not { } p) return new(machineId, null, res.Unavailable, res.Problem);

        var score = new AnomalyScore
        {
            Id = Guid.NewGuid(), MachineId = machineId, ModelVersion = p.ModelVersion, Score = p.AnomalyScore,
            Threshold = p.Threshold, MaxFeatureZ = p.MaxFeatureZ, ZThreshold = p.ZThreshold, IsAnomaly = p.IsAnomaly,
            TopDeviationsJson = JsonSerializer.Serialize(p.TopDeviations), TimestampUtc = now,
            DataOrigin = machine.DataOrigin, SeedBatchId = machine.SeedBatchId, // scored from synthetic readings
        };
        db.AnomalyScores.Add(score);
        await db.SaveChangesAsync(ct);
        return new(machineId, score, false, null);
    }

    public async Task<List<ScoreOutcome>> ScoreAllAsync(CancellationToken ct)
    {
        var ids = await db.Machines.AsNoTracking().Where(m => !m.IsOffline).OrderBy(m => m.Id).Select(m => m.Id).ToListAsync(ct);
        var results = new List<ScoreOutcome>();
        foreach (var id in ids)
        {
            var r = await ScoreAsync(id, ct);
            results.Add(r);
            if (r.Unavailable) break; // don't hammer a dead service
        }
        return results;
    }

    public async Task SyncModelsAsync(CancellationToken ct)
    {
        var res = await ml.ModelsAsync(ct);
        status.Set(!res.Unavailable, res.Unavailable ? "ML service unavailable" : "ML service reachable");
        if (res.Value is null) return;
        var existing = await db.MlModels.ToDictionaryAsync(m => m.Id, ct);
        foreach (var m in res.Value)
        {
            if (!existing.TryGetValue(m.Name, out var row))
                db.MlModels.Add(row = new MlModel { Id = m.Name, Version = m.Version, Type = m.Type, Status = m.Status, DataOrigin = Domain.DataOrigin.Synthetic });
            row.Version = m.Version;
            row.Type = m.Type;
            row.Status = m.Status;
            row.MachineType = m.MachineType;
            row.TrainedUtc = m.TrainedUtc?.ToUniversalTime();
            row.EvaluationSummaryJson = m.Evaluation?.GetRawText();
            row.UpdatedUtc = clock.GetUtcNow().UtcDateTime;
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Machines whose most recent score (within <see cref="Fresh"/>) is an anomaly.</summary>
    public static async Task<HashSet<string>> OpenAnomaliesAsync(TileTwinDbContext db, DateTime now, CancellationToken ct)
    {
        var since = now - Fresh;
        var latest = await db.AnomalyScores.AsNoTracking().Where(a => a.TimestampUtc > since)
            .GroupBy(a => a.MachineId)
            .Select(g => g.OrderByDescending(a => a.TimestampUtc).First())
            .ToListAsync(ct);
        return latest.Where(a => a.IsAnomaly).Select(a => a.MachineId).ToHashSet();
    }
}

/// <summary>Scores every machine every 5 minutes (and syncs the model registry).</summary>
public class AnomalyHostedService(IServiceScopeFactory scopes, ILogger<AnomalyHostedService> log) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Delay(TimeSpan.FromSeconds(15), ct); // let the simulator write its first live readings
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<AnomalyScoringService>();
                await svc.SyncModelsAsync(ct);
                var results = await svc.ScoreAllAsync(ct);
                log.LogInformation("Anomaly scoring: {Scored} scored, {Anomalies} anomalous, {Skipped} not scored",
                    results.Count(r => r.Score is not null), results.Count(r => r.Score?.IsAnomaly == true), results.Count(r => r.Score is null));
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                log.LogError(ex, "Anomaly scoring failed");
            }
        } while (await timer.WaitForNextTickAsync(ct));
    }
}
