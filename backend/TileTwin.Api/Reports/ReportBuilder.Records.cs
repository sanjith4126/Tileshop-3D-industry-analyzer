using Microsoft.EntityFrameworkCore;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Domain.Inspections;

namespace TileTwin.Api.Reports;

public partial class ReportBuilder
{
    async Task<ReportDocument> MaintenanceAsync(DateTime from, DateTime to, string? machineId, DateTime now, CancellationToken ct)
    {
        var records = await db.MaintenanceRecords.AsNoTracking()
            .Where(r => r.PerformedUtc >= from && r.PerformedUtc <= to && (machineId == null || r.MachineId == machineId))
            .OrderByDescending(r => r.PerformedUtc).Take(500).ToListAsync(ct);
        var openAlertMachines = await db.Alerts.AsNoTracking().Where(a => a.Status != AlertStatus.Resolved && (machineId == null || a.MachineId == machineId))
            .Select(a => a.MachineId).Distinct().ToListAsync(ct);

        var summary = records.Count == 0
            ? new List<string> { NoRecords }
            : [
                $"{records.Count} maintenance record(s), {records.Sum(r => r.DurationHours):0.#} h in total, on {records.Select(r => r.MachineId).Distinct().Count()} machine(s).",
                "By type: " + string.Join(", ", records.GroupBy(r => r.Type).Select(g => $"{g.Key} {g.Count()}")) + ".",
              ];
        var recs = openAlertMachines.Where(m => records.All(r => r.MachineId != m || r.Type == MaintenanceType.Preventive))
            .Select(m => $"{m} has open threshold alerts but no corrective work or inspection recorded in this period — consider scheduling an inspection.")
            .ToList();
        if (recs.Count == 0) recs.Add("No gaps between open alerts and recorded maintenance in this period.");

        return new ReportDocument("Maintenance history report", ReportType.MaintenanceHistory, now, from, to, Filters(machineId, null), summary,
        [
            Section("Maintenance records", new ReportTable(["Date", "Machine", "Type", "Description", "Hours", "By", "Outcome"],
                records.Select(r => (IReadOnlyList<string>)[D(r.PerformedUtc), r.MachineId, r.Type.ToString(), r.Description,
                    $"{r.DurationHours:0.#}", r.PerformedBy ?? "", r.Outcome ?? ""]).ToList())),
        ], recs, "TileTwin database: MaintenanceRecords, Alerts.");
    }

    async Task<ReportDocument> InspectionAsync(DateTime from, DateTime to, string? zoneId, DateTime now, CancellationToken ct)
    {
        var obs = await db.InspectionObservations.AsNoTracking().Include(o => o.Zone).Include(o => o.CorrectiveActions)
            .Where(o => o.CreatedUtc >= from && o.CreatedUtc <= to && (zoneId == null || o.ZoneId == zoneId))
            .OrderByDescending(o => o.Priority).ThenBy(o => o.CreatedUtc).Take(500).ToListAsync(ct);
        var scope = zoneId is null ? "All zones" : (await db.Zones.AsNoTracking().FirstOrDefaultAsync(z => z.Id == zoneId, ct))?.Name ?? zoneId;
        var s = InspectionSummaryBuilder.Build(scope, obs, now);
        var overdue = obs.SelectMany(o => o.CorrectiveActions.Where(a => a.DueUtc < now && a.Status is CorrectiveActionStatus.Planned or CorrectiveActionStatus.InProgress)
            .Select(a => (o, a))).ToList();

        return new ReportDocument("Site inspection report", ReportType.SiteInspection, now, from, to, Filters(null, zoneId),
            s.Lines.Take(s.Lines.Count - 1).ToList(),
        [
            Section("Observations raised in period", new ReportTable(["Code", "Raised", "Zone", "Category", "Priority", "Status", "Assigned", "Description"],
                obs.Select(o => (IReadOnlyList<string>)[InspectionSummaryBuilder.Code(o.Id), D(o.CreatedUtc), o.Zone?.Name ?? o.ZoneId, o.Category.ToString(),
                    o.Priority.ToString(), o.Status.ToString(), o.AssignedUser ?? o.AssignedRole ?? "", o.Description]).ToList())),
            Section("Overdue corrective actions", new ReportTable(["Observation", "Action", "Status", "Due"],
                overdue.Select(x => (IReadOnlyList<string>)[InspectionSummaryBuilder.Code(x.o.Id), x.a.Description, x.a.Status.ToString(), D(x.a.DueUtc!.Value)]).ToList())),
        ], s.Lines.Where(l => l.StartsWith("Recommendation")).Select(l => l["Recommendation: ".Length..]).DefaultIfEmpty(NoRecords).ToList(),
            "TileTwin database: InspectionObservations, CorrectiveActions (deterministic InspectionSummaryBuilder).");
    }
}
