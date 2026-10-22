using System.Text.Json;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

/// <summary>Adds audit entries to the current unit of work; saved with the caller's SaveChanges.</summary>
public class AuditLogger(TileTwinDbContext db, TimeProvider clock)
{
    public void Add(string? user, string action, string? entityId, object? details = null) =>
        db.AuditLog.Add(new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            TimestampUtc = clock.GetUtcNow().UtcDateTime,
            UserName = user,
            Action = action,
            EntityId = entityId,
            DetailsJson = details is null ? null : JsonSerializer.Serialize(details),
        });
}
