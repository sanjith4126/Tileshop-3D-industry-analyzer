using System.Security;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Domain.Inspections;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

public class InspectionService(TileTwinDbContext db, TimeProvider clock, AuditLogger audit)
{
    public const int MaxRows = 200;
    DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<List<InspectionZoneDto>> ZonesAsync(CancellationToken ct)
    {
        var zones = await db.Zones.AsNoTracking().OrderBy(z => z.Id).ToListAsync(ct);
        var obs = await db.InspectionObservations.AsNoTracking().Select(o => new { o.ZoneId, o.Status, o.Priority }).ToListAsync(ct);
        return zones.Select(z =>
        {
            var inZone = obs.Where(o => o.ZoneId == z.Id).ToList();
            var open = inZone.Where(o => InspectionSummaryBuilder.IsOpen(o.Status)).ToList();
            return new InspectionZoneDto(z.Id, z.Name, inZone.Count, open.Count, open.Count(o => o.Priority >= ObservationPriority.High));
        }).ToList();
    }

    public async Task<List<ObservationSummaryDto>> ListAsync(string? zoneId, ObservationStatus? status, ObservationPriority? priority,
        string? search, CancellationToken ct)
    {
        var q = Query();
        if (zoneId is not null) q = q.Where(o => o.ZoneId == zoneId);
        if (status is not null) q = q.Where(o => o.Status == status);
        if (priority is not null) q = q.Where(o => o.Priority == priority);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim().Replace("%", "").Replace("_", "")}%";
            q = q.Where(o => EF.Functions.ILike(o.Description, pattern) || (o.MachineId != null && EF.Functions.ILike(o.MachineId, pattern)));
        }
        var rows = await q.OrderByDescending(o => o.CreatedUtc).Take(MaxRows).ToListAsync(ct);
        return rows.OrderBy(o => InspectionSummaryBuilder.IsOpen(o.Status) ? 0 : 1).ThenByDescending(o => o.Priority)
            .ThenByDescending(o => o.CreatedUtc).Select(ToSummary).ToList();
    }

    public async Task<ObservationDetailDto?> GetAsync(Guid id, CancellationToken ct)
    {
        var o = await Query().Include(x => x.Attachments).Include(x => x.Events).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return null;
        var insp = await db.Inspections.AsNoTracking().FirstAsync(i => i.Id == o.InspectionId, ct);
        var now = Now;
        return new ObservationDetailDto(ToSummary(o), insp.Title, insp.InspectorName, insp.PerformedUtc,
            o.CorrectiveActions.OrderBy(a => a.CreatedUtc).Select(a => new CorrectiveActionDto(a.Id, a.Description, a.Status, a.AssignedRole,
                a.CreatedUtc, a.DueUtc, a.CompletedUtc, a.DueUtc < now && a.Status is CorrectiveActionStatus.Planned or CorrectiveActionStatus.InProgress)).ToList(),
            o.Attachments.OrderBy(a => a.CreatedUtc).Select(a => new AttachmentDto(a.Id, a.FileName, a.Caption, a.IsPlaceholder,
                $"/api/observations/attachments/{a.Id}")).ToList(),
            o.Events.OrderBy(e => e.TimestampUtc).Select(e => new ObservationEventDto(e.TimestampUtc, e.UserName, e.Action, e.Details)).ToList());
    }

    public async Task<ObservationDetailDto?> UpdateAsync(Guid id, UpdateObservationRequest req, string user, CancellationToken ct)
    {
        var o = await db.InspectionObservations.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o is null) return null;
        var now = Now;

        void Event(string action, string? details) => db.ObservationEvents.Add(new ObservationEvent
        {
            Id = Guid.NewGuid(), ObservationId = o.Id, TimestampUtc = now, UserName = user, Action = action, Details = details,
            DataOrigin = DataOrigin.Real,
        });

        if (req.Status is { } s && s != o.Status) { Event("Status changed", $"{o.Status} → {s}"); o.Status = s; }
        if (req.AssignedRole is not null && req.AssignedRole != (o.AssignedRole ?? ""))
        {
            o.AssignedRole = req.AssignedRole.Length == 0 ? null : req.AssignedRole;
            Event("Assigned", $"Role: {o.AssignedRole ?? "none"}");
        }
        if (req.AssignedUser is not null && req.AssignedUser != (o.AssignedUser ?? ""))
        {
            o.AssignedUser = req.AssignedUser.Length == 0 ? null : req.AssignedUser.Trim();
            Event("Assigned", $"User: {o.AssignedUser ?? "none"}");
        }
        if (!string.IsNullOrWhiteSpace(req.Comment)) Event("Comment", req.Comment.Trim());

        o.UpdatedUtc = now;
        audit.Add(user, "observation.update", id.ToString(), req);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<InspectionSummary?> SummaryAsync(string? zoneId, CancellationToken ct)
    {
        string scope = "All zones";
        if (zoneId is not null)
        {
            var zone = await db.Zones.AsNoTracking().FirstOrDefaultAsync(z => z.Id == zoneId, ct);
            if (zone is null) return null;
            scope = $"{zone.Name} ({zone.Id})";
        }
        var obs = await Query().Where(o => zoneId == null || o.ZoneId == zoneId).ToListAsync(ct);
        return InspectionSummaryBuilder.Build(scope, obs, Now);
    }

    public async Task<string?> PlaceholderSvgAsync(Guid attachmentId, CancellationToken ct)
    {
        var a = await db.ObservationAttachments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == attachmentId && x.IsPlaceholder, ct);
        if (a is null) return null;
        var caption = SecurityElement.Escape(a.Caption);
        var file = SecurityElement.Escape(a.FileName);
        return $"""
            <svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
              <defs><pattern id="h" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="16" fill="#1e293b"/></pattern></defs>
              <rect width="480" height="300" fill="#0f172a"/><rect width="480" height="300" fill="url(#h)"/>
              <rect x="20" y="105" width="440" height="90" rx="6" fill="#0f172a" stroke="#f59e0b"/>
              <text x="240" y="138" fill="#f59e0b" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">SYNTHETIC PLACEHOLDER IMAGE</text>
              <text x="240" y="162" fill="#cbd5e1" font-family="sans-serif" font-size="13" text-anchor="middle">{caption}</text>
              <text x="240" y="182" fill="#64748b" font-family="sans-serif" font-size="11" text-anchor="middle">{file} · not a real photograph</text>
            </svg>
            """;
    }

    IQueryable<InspectionObservation> Query() =>
        db.InspectionObservations.AsNoTracking().Include(o => o.Zone).Include(o => o.CorrectiveActions);

    static ObservationSummaryDto ToSummary(InspectionObservation o) => new(
        o.Id, InspectionSummaryBuilder.Code(o.Id), o.ZoneId, o.Zone?.Name ?? o.ZoneId, o.MachineId, o.Category, o.Priority, o.Status,
        o.Description, o.AssignedRole, o.AssignedUser, o.CreatedUtc, o.UpdatedUtc,
        o.CorrectiveActions.Count(a => a.Status is CorrectiveActionStatus.Planned or CorrectiveActionStatus.InProgress), o.DataOrigin);
}
