using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Reports;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Domain.Inspections;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Llm;

namespace TileTwin.Api.Assistant;

/// <summary>
/// The assistant's tools: read-only (plus report drafts), validated arguments, row limits.
/// No SQL generation, no shell. Results are JSON data the model must treat as untrusted.
/// </summary>
public class AssistantTools(TileTwinDbContext db, MachineService machines, AlertService alerts, InspectionService inspections,
    ReportService reports, TimeProvider clock)
{
    public const int MaxRows = 30;
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } };
    static readonly string[] Statuses = Enum.GetNames<MachineStatus>();

    public static readonly IReadOnlyList<LlmTool> Definitions =
    [
        new("search_machines", "Find machines by text (ID, name, type), status or zone. Returns up to 30 machines with status and open alert counts.",
            ToolArgs.Schema(("query", "string", "Text to match in ID, name or type", true, null), ("status", "string", "Machine status filter", true, Statuses),
                ("zoneId", "string", "Zone ID, e.g. ZONE-PRESS-A", true, null))),
        new("get_machine_status", "Current status of one machine with reasons, latest sensor readings and limits.",
            ToolArgs.Schema(("machineId", "string", "Machine ID, e.g. MACHINE-HP-002", false, null))),
        new("get_readings_summary", "Statistics per sensor (count, min, max, mean, first/last-hour mean, share of readings beyond warning limits) over the last N hours.",
            ToolArgs.Schema(("machineId", "string", "Machine ID", false, null), ("hours", "integer", "Window in hours, 1-168", false, null))),
        new("list_alerts", "Threshold alerts (deterministic limit crossings). Without status returns Open and Acknowledged alerts.",
            ToolArgs.Schema(("machineId", "string", "Machine ID filter", true, null), ("status", "string", "Alert status", true, Enum.GetNames<AlertStatus>()))),
        new("list_observations", "Remote site inspection observations with codes (OBS-xxxxxx), priority, status and assignment.",
            ToolArgs.Schema(("zoneId", "string", "Zone ID filter", true, null), ("status", "string", "Observation status", true, Enum.GetNames<ObservationStatus>()),
                ("priority", "string", "Priority", true, Enum.GetNames<ObservationPriority>()), ("query", "string", "Text search", true, null))),
        new("get_maintenance_history", "Maintenance records for a machine, newest first.",
            ToolArgs.Schema(("machineId", "string", "Machine ID", false, null), ("limit", "integer", "Number of records, 1-20", false, null))),
        new("get_production_stats", "Production batches over the last N days: units, rejects and reject rate overall and per press.",
            ToolArgs.Schema(("days", "integer", "Window in days, 1-30", false, null))),
        new("search_documents", "Search the Knowledge Centre documents (manuals, procedures).",
            ToolArgs.Schema(("query", "string", "Search text", false, null))),
        new("create_report_draft", "Create a DRAFT report from database records (the only write action). Returns the report ID and link.",
            ToolArgs.Schema(("type", "string", "Report type", false, Enum.GetNames<ReportType>().Where(t => t != nameof(ReportType.MaintenancePrioritisation)).ToArray()),
                ("days", "integer", "Period in days ending now, 1-90", false, null), ("machineId", "string", "Machine filter", true, null), ("zoneId", "string", "Zone filter", true, null))),
    ];

    public async Task<object> ExecuteAsync(string name, ToolArgs a, string user, CancellationToken ct) => name switch
    {
        "search_machines" => await SearchMachines(a.OptString("query"), a.OptEnum<MachineStatus>("status"), a.OptId("zoneId"), ct),
        "get_machine_status" => await machines.GetAsync(a.Id("machineId"), ct) is { } d
            ? new { d.Machine, d.Sensors, recentMaintenance = d.RecentMaintenance.Take(3) } : NotFound("machine"),
        "get_readings_summary" => await ReadingsSummary(a.Id("machineId"), a.Int("hours", 1, 168, 24), ct),
        "list_alerts" => (await alerts.ListAsync(a.OptId("machineId"), a.OptEnum<AlertStatus>("status"), MaxRows, ct))
            .Select(x => new { x.Id, x.MachineId, x.SensorId, x.Measurement, x.Severity, x.ObservedValue, x.Unit, x.Threshold, x.DetectedUtc, x.Status, kind = "threshold alert (not a confirmed fault)" }),
        "list_observations" => (await inspections.ListAsync(a.OptId("zoneId"), a.OptEnum<ObservationStatus>("status"), a.OptEnum<ObservationPriority>("priority"), a.OptString("query"), ct))
            .Take(MaxRows).Select(o => new { o.Code, o.ZoneId, o.MachineId, o.Category, o.Priority, o.Status, o.Description, o.AssignedRole, o.AssignedUser, o.CreatedUtc, o.OpenActions }),
        "get_maintenance_history" => await Maintenance(a.Id("machineId"), a.Int("limit", 1, 20, 10), ct),
        "get_production_stats" => await Production(a.Int("days", 1, 30, 7), ct),
        "search_documents" => new { available = false, message = "Knowledge Centre has no searchable documents yet.", query = a.OptString("query", 200) },
        "create_report_draft" => await ReportDraft(a, user, ct),
        _ => throw new ToolArgumentException($"Unknown tool {name}"),
    };

    public static string Serialize(object result) => JsonSerializer.Serialize(new { dataOrigin = "SYNTHETIC demo data", result }, Json);

    static object NotFound(string what) => new { error = $"{what} not found" };

    async Task<object> SearchMachines(string? query, MachineStatus? status, string? zoneId, CancellationToken ct)
    {
        var list = await machines.ListAsync(zoneId, ct);
        return list.Where(m => status is null || m.Status == status)
            .Where(m => query is null || $"{m.Id} {m.Name} {m.TypeName}".Contains(query, StringComparison.OrdinalIgnoreCase))
            .Take(MaxRows).Select(m => new { m.Id, m.Name, m.TypeName, m.ZoneId, m.Status, m.StatusReasons, m.OpenAlertCount, m.MaintenanceStatus });
    }

    async Task<object> ReadingsSummary(string machineId, int hours, CancellationToken ct)
    {
        var sensors = await db.SensorDefinitions.AsNoTracking().Where(x => x.MachineId == machineId).ToListAsync(ct);
        if (sensors.Count == 0) return NotFound("machine");
        var now = clock.GetUtcNow().UtcDateTime;
        var from = now.AddHours(-hours);
        var window = db.SensorReadings.AsNoTracking().Where(r => r.MachineId == machineId && r.TimestampUtc >= from);

        // All statistics are aggregated in PostgreSQL; nothing row-level is loaded.
        var stats = await window.GroupBy(r => r.SensorId).Select(g => new
        {
            g.Key, Count = g.Count(), Min = g.Min(r => r.Value), Max = g.Max(r => r.Value), Mean = g.Average(r => r.Value),
            Last = g.Max(r => r.TimestampUtc),
        }).ToDictionaryAsync(x => x.Key, ct);
        var firstHour = await window.Where(r => r.TimestampUtc < from.AddHours(1)).GroupBy(r => r.SensorId)
            .Select(g => new { g.Key, Mean = g.Average(r => r.Value) }).ToDictionaryAsync(x => x.Key, x => x.Mean, ct);
        var lastHour = await window.Where(r => r.TimestampUtc > now.AddHours(-1)).GroupBy(r => r.SensorId)
            .Select(g => new { g.Key, Mean = g.Average(r => r.Value) }).ToDictionaryAsync(x => x.Key, x => x.Mean, ct);
        var beyond = await (from r in window
                            join sd in db.SensorDefinitions on r.SensorId equals sd.Id
                            where (sd.WarningMax != null && r.Value > sd.WarningMax) || (sd.WarningMin != null && r.Value < sd.WarningMin)
                            group r by r.SensorId into g
                            select new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        static double? R(double? v) => v is null ? null : Math.Round(v.Value, 3);
        return new
        {
            machineId, hours,
            sensors = sensors.OrderBy(x => x.Id).Select(x => stats.TryGetValue(x.Id, out var st)
                ? (object)new
                {
                    x.Id, x.Measurement, x.Unit, count = st.Count, min = R(st.Min), max = R(st.Max), mean = R(st.Mean),
                    firstHourMean = R(firstHour.GetValueOrDefault(x.Id)), lastHourMean = lastHour.TryGetValue(x.Id, out var lh) ? R(lh) : null,
                    percentBeyondWarning = Math.Round(100.0 * beyond.GetValueOrDefault(x.Id) / st.Count, 1),
                    limits = new { x.WarningMin, x.WarningMax, x.CriticalMin, x.CriticalMax }, lastReadingUtc = st.Last,
                }
                : new { x.Id, x.Measurement, x.Unit, count = 0, note = "no readings in window (missing data)" }),
        };
    }

    async Task<object> Maintenance(string machineId, int limit, CancellationToken ct) =>
        await db.MaintenanceRecords.AsNoTracking().Where(r => r.MachineId == machineId).OrderByDescending(r => r.PerformedUtc).Take(limit)
            .Select(r => new { r.Id, r.MachineId, r.Type, r.Description, r.PerformedUtc, r.DurationHours, r.PerformedBy, r.Outcome }).ToListAsync(ct);

    async Task<object> Production(int days, CancellationToken ct)
    {
        var from = clock.GetUtcNow().UtcDateTime.AddDays(-days);
        var b = await db.ProductionBatches.AsNoTracking().Where(x => x.StartedUtc >= from).ToListAsync(ct);
        double Rate(IEnumerable<ProductionBatch> x) => x.Sum(y => y.UnitsProduced) is var n and > 0 ? Math.Round(100.0 * x.Sum(y => y.UnitsRejected) / n, 2) : 0;
        return new
        {
            days, batches = b.Count, unitsProduced = b.Sum(x => x.UnitsProduced), unitsRejected = b.Sum(x => x.UnitsRejected), rejectRatePercent = Rate(b),
            byPress = b.GroupBy(x => x.PressMachineId).OrderBy(g => g.Key).Select(g => new { pressMachineId = g.Key, batches = g.Count(), rejectRatePercent = Rate(g) }),
        };
    }

    async Task<object> ReportDraft(ToolArgs a, string user, CancellationToken ct)
    {
        var type = a.OptEnum<ReportType>("type") ?? throw new ToolArgumentException("type is required");
        if (type == ReportType.MaintenancePrioritisation) throw new ToolArgumentException("Use the maintenance-prioritisation workflow for that report");
        var now = clock.GetUtcNow().UtcDateTime;
        var r = await reports.CreateAsync(new ReportRequest(type, now.AddDays(-a.Int("days", 1, 90, 7)), now, a.OptId("machineId"), a.OptId("zoneId"), ReportStatus.Draft), user, ct);
        return new { reportId = r.Id, status = "Draft", title = r.Document.Title, url = $"/reports/{r.Id}", summary = r.Document.Summary };
    }
}
