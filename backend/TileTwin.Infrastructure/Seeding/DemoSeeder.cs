using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TileTwin.Domain;
using TileTwin.Domain.Alerts;
using TileTwin.Domain.Entities;
using TileTwin.Domain.Knowledge;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Simulation;
using static TileTwin.Infrastructure.Seeding.DemoPlant;

namespace TileTwin.Infrastructure.Seeding;

/// <summary>
/// Deterministic demo seed. Reset deletes only rows with DataOrigin=Synthetic and SeedBatchId=demo batch,
/// inside one transaction, then re-seeds. User-created rows are never touched; synthetic parents that
/// still have user-created children are kept.
/// </summary>
public class DemoSeeder(TileTwinDbContext db, ILogger<DemoSeeder> log)
{
    public const int RandomSeed = 20261022;
    public static readonly TimeSpan History = TimeSpan.FromDays(7);

    public async Task<bool> SeedIfEmptyAsync(DateTime nowUtc, CancellationToken ct = default)
    {
        if (await db.DemoState.AnyAsync(ct)) return false;
        await ResetAsync(nowUtc, ct);
        return true;
    }

    public async Task ResetAsync(DateTime nowUtc, CancellationToken ct = default)
    {
        var anchor = new DateTime(nowUtc.Ticks - nowUtc.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);
        var rng = new Random(RandomSeed);
        var started = DateTime.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await DeleteDemoRowsAsync(ct);
        await UpsertMasterDataAsync(ct);

        var (inspections, observations, actions) = DemoRecords.BuildInspections(anchor);
        await AddMissingAsync(db.Inspections, inspections, x => x.Id, ct);
        await AddMissingAsync(db.InspectionObservations, observations, x => x.Id, ct);
        await AddMissingAsync(db.CorrectiveActions, actions, x => x.Id, ct);
        var (attachments, events) = DemoRecords.BuildObservationExtras(observations);
        await AddMissingAsync(db.ObservationAttachments, attachments, x => x.Id, ct);
        await AddMissingAsync(db.ObservationEvents, events, x => x.Id, ct);
        SeedDocuments(anchor);
        await AddMissingAsync(db.MaintenanceRecords, DemoRecords.BuildMaintenance(anchor), x => x.Id, ct);
        await AddMissingAsync(db.ProductionBatches, DemoRecords.BuildBatches(anchor, rng), x => x.Id, ct);

        var state = await db.DemoState.FindAsync([1], ct);
        if (state is null) db.DemoState.Add(state = new DemoState { SeedBatchId = SeedBatchId });
        state.AnchorUtc = anchor;
        state.SeededUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var readings = await CopyReadingsAsync(anchor, rng, ct);
        await tx.CommitAsync(ct);
        db.ChangeTracker.Clear();

        log.LogInformation("Demo data seeded: batch {Batch}, anchor {Anchor:u}, {Readings} readings in {Seconds:0.0}s",
            SeedBatchId, anchor, readings, (DateTime.UtcNow - started).TotalSeconds);
    }

    void SeedDocuments(DateTime anchor)
    {
        foreach (var d in DemoDocuments.All)
        {
            var text = d.Text; // raw string literals already strip the indentation
            var id = DemoRecords.StableGuid($"doc:{d.Key}");
            var chunks = TextChunker.Chunk(text);
            db.Documents.Add(DemoRecords.Tag(new Document
            {
                Id = id, Title = d.Title, FileName = d.FileName, ContentType = "text/markdown", SizeBytes = text.Length,
                UploadedBy = "seed (demo)", UploadedUtc = anchor.AddDays(-20), Status = DocumentStatus.Indexed, ExtractedText = text,
                ChunkCount = chunks.Count, IndexedUtc = anchor.AddDays(-20),
            }));
            db.DocumentChunks.AddRange(chunks.Select((c, i) => DemoRecords.Tag(new DocumentChunk
                { Id = DemoRecords.StableGuid($"doc:{d.Key}:{i}"), DocumentId = id, Index = i, Text = c })));
        }
    }

    async Task DeleteDemoRowsAsync(CancellationToken ct)
    {
        await db.SensorReadings.Where(IsDemo<SensorReading>()).ExecuteDeleteAsync(ct);
        await db.DocumentChunks.Where(IsDemo<DocumentChunk>()).ExecuteDeleteAsync(ct);
        await db.Documents.Where(IsDemo<Document>()).ExecuteDeleteAsync(ct);
        await db.AnomalyScores.Where(IsDemo<AnomalyScore>()).ExecuteDeleteAsync(ct);
        await db.Alerts.Where(IsDemo<Alert>())
            .Where(a => !db.AlertAcknowledgements.Any(h => h.AlertId == a.Id)).ExecuteDeleteAsync(ct);
        await db.CorrectiveActions.Where(IsDemo<CorrectiveAction>()).ExecuteDeleteAsync(ct);
        await db.ObservationAttachments.Where(IsDemo<ObservationAttachment>()).ExecuteDeleteAsync(ct);
        await db.ObservationEvents.Where(IsDemo<ObservationEvent>()).ExecuteDeleteAsync(ct);
        await db.InspectionObservations.Where(IsDemo<InspectionObservation>())
            .Where(o => !db.CorrectiveActions.Any(a => a.ObservationId == o.Id)
                        && !db.ObservationAttachments.Any(a => a.ObservationId == o.Id)
                        && !db.ObservationEvents.Any(e => e.ObservationId == o.Id))
            .ExecuteDeleteAsync(ct);
        await db.Inspections.Where(IsDemo<Inspection>())
            .Where(i => !db.InspectionObservations.Any(o => o.InspectionId == i.Id)).ExecuteDeleteAsync(ct);
        await db.MaintenanceRecords.Where(IsDemo<MaintenanceRecord>()).ExecuteDeleteAsync(ct);
        await db.ProductionBatches.Where(IsDemo<ProductionBatch>()).ExecuteDeleteAsync(ct);
        // Site, zones, machine types, machines and sensors are upserted, not deleted, so user rows referencing them survive.
    }

    static System.Linq.Expressions.Expression<Func<T, bool>> IsDemo<T>() where T : BusinessEntity =>
        e => e.DataOrigin == DataOrigin.Synthetic && e.SeedBatchId == SeedBatchId;

    async Task UpsertMasterDataAsync(CancellationToken ct)
    {
        await UpsertAsync(db.Sites, [DemoRecords.Tag(new Site { Id = SiteId, Name = SiteName })], x => x.Id, ct);
        await UpsertAsync(db.Zones, Zones.Select(z => DemoRecords.Tag(new Zone
            { Id = z.Id, SiteId = SiteId, Name = z.Name, Description = z.Description })), x => x.Id, ct);
        await UpsertAsync(db.MachineTypes, MachineTypes.Select(t => DemoRecords.Tag(new MachineType
            { Id = t.Id, Name = t.Name })), x => x.Id, ct);
        await db.SaveChangesAsync(ct);

        await UpsertAsync(db.Machines, Machines.Select(m => DemoRecords.Tag(new Machine
        {
            Id = m.Id, Name = m.Name, MachineTypeId = m.TypeId, ZoneId = m.ZoneId,
            Manufacturer = null, Model = null,
            IsOffline = m.Id == SignalModel.OfflineMachine,
            MaintenanceStatus = m.Id == SignalModel.OfflineMachine ? MaintenanceStatus.UnderMaintenance
                : m.Id == "MACHINE-MOTOR-002" ? MaintenanceStatus.MaintenanceScheduled : MaintenanceStatus.InService,
        })), x => x.Id, ct);
        await db.SaveChangesAsync(ct);

        await UpsertAsync(db.SensorDefinitions, Machines.SelectMany(m => m.Sensors.Select(s => DemoRecords.Tag(new SensorDefinition
        {
            Id = SensorId(m.Id, s.Suffix), MachineId = m.Id, Measurement = s.Measurement, Unit = s.Unit,
            WarningMin = s.WarningMin, WarningMax = s.WarningMax, CriticalMin = s.CriticalMin, CriticalMax = s.CriticalMax,
        }))), x => x.Id, ct);
        await db.SaveChangesAsync(ct);
    }

    async Task UpsertAsync<T>(DbSet<T> set, IEnumerable<T> seeds, Func<T, string> key, CancellationToken ct)
        where T : BusinessEntity
    {
        var existing = (await set.ToListAsync(ct)).ToDictionary(key);
        foreach (var seed in seeds)
        {
            if (!existing.TryGetValue(key(seed), out var row)) set.Add(seed);
            else if (row.DataOrigin == DataOrigin.Synthetic) db.Entry(row).CurrentValues.SetValues(seed);
        }
    }

    async Task AddMissingAsync<T>(DbSet<T> set, IEnumerable<T> seeds, Func<T, Guid> key, CancellationToken ct)
        where T : class
    {
        var existing = (await set.Select(e => EF.Property<Guid>(e, "Id")).ToListAsync(ct)).ToHashSet();
        set.AddRange(seeds.Where(s => !existing.Contains(key(s))));
        await db.SaveChangesAsync(ct);
    }

    async Task<long> CopyReadingsAsync(DateTime anchor, Random rng, CancellationToken ct)
    {
        var rows = GenerateHistory(anchor, rng).ToList();
        var count = await ReadingWriter.CopyAsync(db, rows, ct);

        // Replay the threshold rules over the history so alerts exist with their real crossing times.
        var limits = await db.SensorDefinitions.AsNoTracking()
            .ToDictionaryAsync(s => s.Id, s => new SensorLimits(s.WarningMin, s.WarningMax, s.CriticalMin, s.CriticalMax), ct);
        var open = await db.Alerts.Where(a => a.Status != AlertStatus.Resolved)
            .Select(a => new { a.MachineId, a.SensorId, a.Severity }).ToListAsync(ct);
        var alerts = ReadingWriter.DetectAlerts(rows, limits,
            new AlertDetector(open.Select(a => (a.MachineId, a.SensorId, a.Severity))),
            c => DemoRecords.StableGuid($"alert:{c.SensorId}:{c.Severity}"));
        await AddMissingAsync(db.Alerts, alerts, a => a.Id, ct); // alerts kept because users acted on them keep their stable ID
        return count;
    }

    static IEnumerable<ReadingRow> GenerateHistory(DateTime anchor, Random rng)
    {
        foreach (var m in Machines)
            foreach (var s in m.Sensors)
            {
                var sensorId = SensorId(m.Id, s.Suffix);
                for (var t = anchor - History; t <= anchor; t = t.AddMinutes(1))
                {
                    var value = SignalModel.Value(m.Id, s, t, anchor, rng); // always draw, keeps the sequence stable
                    if (SignalModel.HasReading(m.Id, s.Suffix, t, anchor))
                        yield return new ReadingRow(m.Id, sensorId, value, t);
                }
            }
    }
}
