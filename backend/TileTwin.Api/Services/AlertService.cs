using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

public class AlertService(TileTwinDbContext db, TimeProvider clock, AuditLogger audit)
{
    public const int MaxRows = 200;

    /// <param name="status">Open, Acknowledged, Resolved, or null for all not-resolved ("active").</param>
    public async Task<List<AlertDto>> ListAsync(string? machineId, AlertStatus? status, int limit, CancellationToken ct)
    {
        var q = db.Alerts.AsNoTracking().Include(a => a.History).AsQueryable();
        if (machineId is not null) q = q.Where(a => a.MachineId == machineId);
        q = status is null ? q.Where(a => a.Status != AlertStatus.Resolved) : q.Where(a => a.Status == status);
        var alerts = await q.OrderBy(a => a.Severity == AlertSeverity.Critical ? 0 : 1).ThenByDescending(a => a.DetectedUtc)
            .Take(Math.Clamp(limit, 1, MaxRows)).ToListAsync(ct);
        return await ToDtosAsync(alerts, ct);
    }

    public enum ActionResult { Ok, NotFound, InvalidTransition }

    public async Task<(ActionResult Result, AlertDto? Alert)> ApplyAsync(Guid id, AlertStatus newStatus, string user, string? comment, CancellationToken ct)
    {
        var alert = await db.Alerts.Include(a => a.History).FirstOrDefaultAsync(a => a.Id == id, ct);
        if (alert is null) return (ActionResult.NotFound, null);

        var allowed = newStatus switch
        {
            AlertStatus.Acknowledged => alert.Status == AlertStatus.Open,
            AlertStatus.Resolved => alert.Status != AlertStatus.Resolved,
            _ => false,
        };
        if (!allowed) return (ActionResult.InvalidTransition, null);

        var now = clock.GetUtcNow().UtcDateTime;
        alert.Status = newStatus;
        if (newStatus == AlertStatus.Resolved) alert.ResolvedUtc = now;
        var entry = new AlertAcknowledgement
        {
            Id = Guid.NewGuid(), AlertId = alert.Id, NewStatus = newStatus, UserName = user,
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(), TimestampUtc = now,
            DataOrigin = DataOrigin.Real,
        };
        db.AlertAcknowledgements.Add(entry); // EF fix-up also adds it to alert.History
        audit.Add(user, $"alert.{newStatus.ToString().ToLowerInvariant()}", alert.Id.ToString(), new { comment });
        await db.SaveChangesAsync(ct);
        return (ActionResult.Ok, (await ToDtosAsync([alert], ct))[0]);
    }

    async Task<List<AlertDto>> ToDtosAsync(List<Alert> alerts, CancellationToken ct)
    {
        var sensorIds = alerts.Select(a => a.SensorId).Distinct().ToList();
        var machineIds = alerts.Select(a => a.MachineId).Distinct().ToList();
        var sensors = await db.SensorDefinitions.AsNoTracking().Where(s => sensorIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var machines = await db.Machines.AsNoTracking().Where(m => machineIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.Name, ct);
        return alerts.Select(a =>
        {
            var s = sensors.GetValueOrDefault(a.SensorId);
            return new AlertDto(a.Id, a.MachineId, machines.GetValueOrDefault(a.MachineId) ?? a.MachineId, a.SensorId,
                s?.Measurement ?? a.SensorId, s?.Unit ?? "", a.Severity, a.ObservedValue, a.Threshold, a.DetectedUtc,
                a.Status, a.ResolvedUtc, a.DataOrigin,
                a.History.OrderBy(h => h.TimestampUtc).Select(h => new AlertHistoryDto(h.NewStatus, h.UserName, h.Comment, h.TimestampUtc)).ToList());
        }).ToList();
    }
}
