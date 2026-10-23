using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using TileTwin.Domain;
using TileTwin.Domain.Alerts;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Seeding;

namespace TileTwin.Infrastructure.Simulation;

public readonly record struct ReadingRow(string MachineId, string SensorId, double Value, DateTime TimestampUtc);

public static class ReadingWriter
{
    /// <summary>Bulk-inserts synthetic readings with binary COPY (uses the context's current transaction).</summary>
    public static async Task<long> CopyAsync(TileTwinDbContext db, IEnumerable<ReadingRow> rows, CancellationToken ct)
    {
        await db.Database.OpenConnectionAsync(ct);
        var conn = (NpgsqlConnection)db.Database.GetDbConnection();
        await using var writer = await conn.BeginBinaryImportAsync(
            """COPY "SensorReadings" ("MachineId", "SensorId", "Value", "TimestampUtc", "DataOrigin", "SeedBatchId") FROM STDIN (FORMAT BINARY)""", ct);

        long count = 0;
        foreach (var r in rows)
        {
            await writer.StartRowAsync(ct);
            await writer.WriteAsync(r.MachineId, NpgsqlDbType.Text, ct);
            await writer.WriteAsync(r.SensorId, NpgsqlDbType.Text, ct);
            await writer.WriteAsync(r.Value, NpgsqlDbType.Double, ct);
            await writer.WriteAsync(r.TimestampUtc, NpgsqlDbType.TimestampTz, ct);
            await writer.WriteAsync(nameof(DataOrigin.Synthetic), NpgsqlDbType.Varchar, ct);
            await writer.WriteAsync(DemoPlant.SeedBatchId, NpgsqlDbType.Text, ct);
            count++;
        }
        await writer.CompleteAsync(ct);
        return count;
    }

    /// <summary>Runs the threshold rules over readings in time order and returns alert entities to insert.</summary>
    public static List<Alert> DetectAlerts(IEnumerable<ReadingRow> rows, IReadOnlyDictionary<string, SensorLimits> limits,
        AlertDetector detector, Func<AlertCandidate, Guid> idFor)
    {
        var alerts = new List<Alert>();
        foreach (var r in rows)
        {
            if (!limits.TryGetValue(r.SensorId, out var l)) continue;
            if (detector.Observe(r.MachineId, r.SensorId, l, r.Value, r.TimestampUtc) is not { } c) continue;
            alerts.Add(DemoRecords.Tag(new Alert
            {
                Id = idFor(c), MachineId = c.MachineId, SensorId = c.SensorId, Severity = c.Severity,
                ObservedValue = c.ObservedValue, Threshold = c.Threshold, DetectedUtc = c.DetectedUtc, Status = AlertStatus.Open,
            }));
        }
        return alerts;
    }
}
