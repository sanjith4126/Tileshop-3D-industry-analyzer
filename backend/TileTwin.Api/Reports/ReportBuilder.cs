using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Reports;

/// <summary>Builds report documents from database records only. Empty periods produce a valid "no records" report.</summary>
public partial class ReportBuilder(TileTwinDbContext db, MachineService machines, AlertService alerts, PredictiveService predictive)
{
    public const string NoRecords = "No records for this period.";

    public Task<ReportDocument> BuildAsync(ReportType type, DateTime from, DateTime to, string? machineId, string? zoneId, DateTime now, CancellationToken ct) => type switch
    {
        ReportType.FactoryHealth => FactoryHealthAsync(from, to, now, ct),
        ReportType.MachineAnomalies => MachineAnomaliesAsync(from, to, machineId, now, ct),
        ReportType.MaintenanceHistory => MaintenanceAsync(from, to, machineId, now, ct),
        ReportType.SiteInspection => InspectionAsync(from, to, zoneId, now, ct),
        _ => throw new ArgumentOutOfRangeException(nameof(type)),
    };

    static string D(DateTime t) => t.ToString("yyyy-MM-dd HH:mm") + " UTC";

    static ReportSection Section(string heading, ReportTable? table, params string[] paragraphs) =>
        table is { Rows.Count: 0 } ? new(heading, [.. paragraphs, NoRecords]) : new(heading, paragraphs, table);

    static Dictionary<string, string> Filters(string? machineId, string? zoneId)
    {
        var f = new Dictionary<string, string>();
        if (machineId is not null) f["Machine"] = machineId;
        if (zoneId is not null) f["Zone"] = zoneId;
        return f;
    }

    async Task<ReportDocument> FactoryHealthAsync(DateTime from, DateTime to, DateTime now, CancellationToken ct)
    {
        var list = await machines.ListAsync(ct: ct);
        var open = await alerts.ListAsync(null, null, AlertService.MaxRows, ct);
        var highObs = await db.InspectionObservations.AsNoTracking().Include(o => o.Zone)
            .Where(o => (o.Status == ObservationStatus.Open || o.Status == ObservationStatus.InProgress)
                        && (o.Priority == ObservationPriority.High || o.Priority == ObservationPriority.Critical))
            .OrderByDescending(o => o.Priority).ToListAsync(ct);
        var anomalous = await db.AnomalyScores.AsNoTracking().Where(a => a.TimestampUtc >= from && a.TimestampUtc <= to && a.IsAnomaly)
            .Select(a => a.MachineId).Distinct().ToListAsync(ct);

        var counts = string.Join(", ", Enum.GetValues<MachineStatus>().Select(s => $"{list.Count(m => m.Status == s)} {s}"));
        var summary = new List<string>
        {
            $"{list.Count} machines: {counts} (status at {D(now)}).",
            $"{open.Count} open or acknowledged threshold alert(s), {open.Count(a => a.Severity == AlertSeverity.Critical)} critical.",
            $"{highObs.Count} open high/critical inspection observation(s).",
            anomalous.Count == 0 ? "No ML statistical anomalies in the period." : $"ML statistical anomalies in the period on: {string.Join(", ", anomalous)} (unusual data, not confirmed faults).",
        };

        var recs = list.Where(m => m.Status is MachineStatus.Critical or MachineStatus.Warning)
            .Select(m => $"{m.Id} ({m.Status}): investigate — {string.Join("; ", m.StatusReasons)}. See Predictive Maintenance for suggested inspections.")
            .Concat(list.Where(m => m.Status == MachineStatus.Unknown).Select(m => $"{m.Id} (Unknown): restore missing sensor data — {string.Join("; ", m.StatusReasons)}."))
            .Concat(highObs.Where(o => o.Priority == ObservationPriority.Critical).Select(o => $"Close critical observation {Domain.Inspections.InspectionSummaryBuilder.Code(o.Id)} ({o.Zone?.Name}): {o.Description}"))
            .ToList();
        if (recs.Count == 0) recs.Add("No immediate action indicated by the records.");

        return new ReportDocument("Factory health report", ReportType.FactoryHealth, now, from, to, new Dictionary<string, string>(), summary,
        [
            Section("Machine status", new ReportTable(["Machine", "Name", "Zone", "Status", "Reasons", "Open alerts"],
                list.Select(m => (IReadOnlyList<string>)[m.Id, m.Name, m.ZoneName, m.Status.ToString(), string.Join("; ", m.StatusReasons), m.OpenAlertCount.ToString()]).ToList())),
            Section("Open threshold alerts", AlertTable(open)),
            Section("Open high-priority observations", new ReportTable(["Code", "Zone", "Priority", "Status", "Description"],
                highObs.Select(o => (IReadOnlyList<string>)[Domain.Inspections.InspectionSummaryBuilder.Code(o.Id), o.Zone?.Name ?? o.ZoneId, o.Priority.ToString(), o.Status.ToString(), o.Description]).ToList())),
        ], recs, "TileTwin database: Machines, SensorReadings (latest), Alerts, InspectionObservations, AnomalyScores.", list.Any(m => m.DataOrigin == DataOrigin.Synthetic));
    }

    async Task<ReportDocument> MachineAnomaliesAsync(DateTime from, DateTime to, string? machineId, DateTime now, CancellationToken ct)
    {
        var alertRows = await db.Alerts.AsNoTracking().Include(a => a.History)
            .Where(a => a.DetectedUtc >= from && a.DetectedUtc <= to && (machineId == null || a.MachineId == machineId))
            .OrderBy(a => a.DetectedUtc).Take(500).ToListAsync(ct);
        var sensors = await db.SensorDefinitions.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Measurement, ct);
        var scores = await db.AnomalyScores.AsNoTracking()
            .Where(a => a.TimestampUtc >= from && a.TimestampUtc <= to && (machineId == null || a.MachineId == machineId)).ToListAsync(ct);
        var byMachine = scores.GroupBy(s => s.MachineId).Where(g => g.Any(s => s.IsAnomaly)).OrderBy(g => g.Key).ToList();

        var involved = alertRows.Select(a => a.MachineId).Concat(byMachine.Select(g => g.Key)).Distinct().OrderBy(x => x).ToList();
        var recs = new List<string>();
        foreach (var id in involved.Take(10))
            if (await predictive.GetAsync(id, ct) is { } p && p.SuggestedActions.Count > 0)
                recs.Add($"{id}: " + string.Join(" ", p.SuggestedActions.Take(3).Select(s => $"[{s.RuleId}] {s.Action}.")));
        recs.Add(PredictiveService.ReviewLabel);

        var summary = new List<string>
        {
            $"{alertRows.Count} threshold alert(s) detected in the period ({alertRows.Count(a => a.Severity == AlertSeverity.Critical)} critical) on {alertRows.Select(a => a.MachineId).Distinct().Count()} machine(s).",
            byMachine.Count == 0 ? "No ML statistical anomalies in the period." : $"ML statistical anomalies on {byMachine.Count} machine(s): {string.Join(", ", byMachine.Select(g => g.Key))}.",
            "Threshold alerts are deterministic limit crossings; ML anomalies mean unusual data, not confirmed faults. Failure prediction is not implemented.",
        };
        return new ReportDocument("Machine anomalies report", ReportType.MachineAnomalies, now, from, to, Filters(machineId, null), summary,
        [
            Section("Threshold alerts detected in period", new ReportTable(["Detected", "Machine", "Sensor", "Severity", "Value", "Limit", "Status"],
                alertRows.Select(a => (IReadOnlyList<string>)[D(a.DetectedUtc), a.MachineId, $"{sensors.GetValueOrDefault(a.SensorId) ?? "?"} ({a.SensorId})",
                    a.Severity.ToString(), $"{a.ObservedValue:0.##}", $"{a.Threshold:0.##}", a.Status.ToString()]).ToList())),
            Section("ML statistical anomalies", new ReportTable(["Machine", "Windows scored", "Flagged", "Max score", "Threshold", "Last flagged"],
                byMachine.Select(g => (IReadOnlyList<string>)[g.Key, g.Count().ToString(), g.Count(s => s.IsAnomaly).ToString(),
                    $"{g.Max(s => s.Score):0.###}", $"{g.First().Threshold:0.###}", D(g.Where(s => s.IsAnomaly).Max(s => s.TimestampUtc))]).ToList()),
                "Scores come from the ML service (Isolation Forest + feature-range check, trained on synthetic data)."),
        ], recs, "TileTwin database: Alerts, AnomalyScores, SensorReadings (trends), suggestion rule table (docs/MAINTENANCE-RULES.md).", true);
    }

    static ReportTable AlertTable(IReadOnlyList<AlertDto> list) => new(["Detected", "Machine", "Sensor", "Severity", "Value", "Limit", "Status"],
        list.Select(a => (IReadOnlyList<string>)[D(a.DetectedUtc), a.MachineId, a.Measurement, a.Severity.ToString(),
            $"{a.ObservedValue:0.##} {a.Unit}", $"{a.Threshold:0.##}", a.Status.ToString()]).ToList());
}
