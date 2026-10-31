using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Domain.Status;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

public class MachineService(TileTwinDbContext db, TimeProvider clock, AuditLogger audit)
{
    const string UnknownDemo = "Unknown (demo)";

    public async Task<List<MachineSummaryDto>> ListAsync(string? zoneId = null, CancellationToken ct = default)
    {
        var machines = await db.Machines.AsNoTracking()
            .Include(m => m.Zone).Include(m => m.MachineType)
            .Where(m => zoneId == null || m.ZoneId == zoneId)
            .OrderBy(m => m.Id).ToListAsync(ct);
        var sensors = await LoadSensorsAsync(machines.Select(m => m.Id).ToList(), ct);
        var alerts = await OpenAlertCountsAsync(ct);
        var now = clock.GetUtcNow().UtcDateTime;
        var anomalies = await AnomalyScoringService.OpenAnomaliesAsync(db, now, ct);
        return machines.Select(m => Summarize(m, sensors.GetValueOrDefault(m.Id) ?? [], now, alerts.GetValueOrDefault(m.Id), anomalies.Contains(m.Id))).ToList();
    }

    public async Task<MachineDetailDto?> GetAsync(string id, CancellationToken ct = default)
    {
        var m = await db.Machines.AsNoTracking().Include(x => x.Zone).Include(x => x.MachineType)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (m is null) return null;

        var sensors = (await LoadSensorsAsync([id], ct)).GetValueOrDefault(id) ?? [];
        var now = clock.GetUtcNow().UtcDateTime;
        var maintenance = await db.MaintenanceRecords.AsNoTracking().Where(r => r.MachineId == id)
            .OrderByDescending(r => r.PerformedUtc).Take(10)
            .Select(r => new MaintenanceRecordDto(r.Id, r.MachineId, r.Type, r.Description, r.PerformedBy,
                r.PerformedUtc, r.DurationHours, r.Outcome, r.DataOrigin))
            .ToListAsync(ct);

        var alerts = await OpenAlertCountsAsync(ct);
        var anomalies = await AnomalyScoringService.OpenAnomaliesAsync(db, now, ct);
        return new MachineDetailDto(
            Summarize(m, sensors, now, alerts.GetValueOrDefault(id), anomalies.Contains(id)),
            sensors.Select(s => new SensorDto(s.SensorId, s.Measurement, s.Unit, s.IsRequired,
                s.WarningMin, s.WarningMax, s.CriticalMin, s.CriticalMax,
                s.LatestValue, s.LatestTimestampUtc, SensorStateOf(s, now))).ToList(),
            maintenance, now);
    }

    public async Task<bool> UpdateStateAsync(string id, UpdateMachineStateRequest req, string? user, CancellationToken ct)
    {
        var m = await db.Machines.FindAsync([id], ct);
        if (m is null) return false;
        m.MaintenanceStatus = req.MaintenanceStatus!.Value;
        m.IsOffline = req.IsFlaggedOffline;
        audit.Add(user, "machine.update-state", id, req);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public sealed record SensorRow(string SensorId, string MachineId, string Measurement, string Unit, bool IsRequired,
        double? WarningMin, double? WarningMax, double? CriticalMin, double? CriticalMax,
        double? LatestValue, DateTime? LatestTimestampUtc);

    async Task<Dictionary<string, List<SensorRow>>> LoadSensorsAsync(List<string> machineIds, CancellationToken ct)
    {
        // Raw SQL: EF translates "latest per group" to ROW_NUMBER over the whole table; LATERAL uses the
        // (MachineId, SensorId, TimestampUtc) index and reads one row per sensor.
        var ids = machineIds.ToArray();
        var rows = await db.Database.SqlQuery<SensorRow>($"""
            SELECT s."Id" AS "SensorId", s."MachineId", s."Measurement", s."Unit", s."IsRequired",
                   s."WarningMin", s."WarningMax", s."CriticalMin", s."CriticalMax",
                   r."Value" AS "LatestValue", r."TimestampUtc" AS "LatestTimestampUtc"
            FROM "SensorDefinitions" s
            LEFT JOIN LATERAL (
                SELECT "Value", "TimestampUtc" FROM "SensorReadings"
                WHERE "MachineId" = s."MachineId" AND "SensorId" = s."Id"
                ORDER BY "TimestampUtc" DESC LIMIT 1) r ON TRUE
            WHERE s."MachineId" = ANY({ids})
            ORDER BY s."Id"
            """).ToListAsync(ct);

        return rows.GroupBy(r => r.MachineId).ToDictionary(g => g.Key, g => g.ToList());
    }

    Task<Dictionary<string, int>> OpenAlertCountsAsync(CancellationToken ct) =>
        db.Alerts.Where(a => a.Status != AlertStatus.Resolved).GroupBy(a => a.MachineId)
            .ToDictionaryAsync(g => g.Key, g => g.Count(), ct);

    static MachineSummaryDto Summarize(Machine m, List<SensorRow> sensors, DateTime now, int openAlerts, bool openAnomaly)
    {
        var result = MachineStatusCalculator.Evaluate(m.IsOffline, sensors.Select(ToState).ToList(), now, openAnomaly);
        return new MachineSummaryDto(m.Id, m.Name, m.MachineTypeId, m.MachineType?.Name ?? m.MachineTypeId,
            m.ZoneId, m.Zone?.Name ?? m.ZoneId, result.Status, result.Reasons, m.MaintenanceStatus, m.IsOffline,
            m.Manufacturer ?? UnknownDemo, m.Model ?? UnknownDemo, m.DataOrigin,
            sensors.Max(s => s.LatestTimestampUtc), openAlerts);
    }

    static SensorState ToState(SensorRow s) => new(s.SensorId, s.Measurement, s.IsRequired,
        s.WarningMin, s.WarningMax, s.CriticalMin, s.CriticalMax, s.LatestValue, s.LatestTimestampUtc);

    static string SensorStateOf(SensorRow s, DateTime now)
    {
        if (s.LatestValue is null || s.LatestTimestampUtc is null
            || now - s.LatestTimestampUtc.Value > MachineStatusCalculator.StaleAfter) return "Missing";
        if (MachineStatusCalculator.Beyond(s.LatestValue.Value, s.CriticalMin, s.CriticalMax)) return "Critical";
        if (MachineStatusCalculator.Beyond(s.LatestValue.Value, s.WarningMin, s.WarningMax)) return "Warning";
        return "Normal";
    }
}
