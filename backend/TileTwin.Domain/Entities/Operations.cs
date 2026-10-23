namespace TileTwin.Domain.Entities;

public class Inspection : BusinessEntity
{
    public Guid Id { get; set; }
    public required string Title { get; set; }
    public required string ZoneId { get; set; }
    public string? InspectorName { get; set; }
    public DateTime PerformedUtc { get; set; }
    public List<InspectionObservation> Observations { get; set; } = [];
}

public class InspectionObservation : BusinessEntity
{
    public Guid Id { get; set; }
    public Guid InspectionId { get; set; }
    public required string ZoneId { get; set; }
    public Zone? Zone { get; set; }
    public string? MachineId { get; set; }
    public ObservationCategory Category { get; set; }
    public required string Description { get; set; }
    public ObservationPriority Priority { get; set; }
    public ObservationStatus Status { get; set; }
    public string? AssignedRole { get; set; }
    public string? AssignedUser { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public List<CorrectiveAction> CorrectiveActions { get; set; } = [];
    public List<ObservationAttachment> Attachments { get; set; } = [];
    public List<ObservationEvent> Events { get; set; } = [];
}

/// <summary>Attachment metadata. Demo attachments are generated placeholder images, clearly labelled as such.</summary>
public class ObservationAttachment : BusinessEntity
{
    public Guid Id { get; set; }
    public Guid ObservationId { get; set; }
    public required string FileName { get; set; }
    public required string Caption { get; set; }
    public bool IsPlaceholder { get; set; }
    public DateTime CreatedUtc { get; set; }
}

/// <summary>History entry for an observation (created, status change, assignment, comment).</summary>
public class ObservationEvent : BusinessEntity
{
    public Guid Id { get; set; }
    public Guid ObservationId { get; set; }
    public DateTime TimestampUtc { get; set; }
    public required string UserName { get; set; }
    public required string Action { get; set; }
    public string? Details { get; set; }
}

public class CorrectiveAction : BusinessEntity
{
    public Guid Id { get; set; }
    public Guid ObservationId { get; set; }
    public required string Description { get; set; }
    public CorrectiveActionStatus Status { get; set; }
    public string? AssignedRole { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime? DueUtc { get; set; }
    public DateTime? CompletedUtc { get; set; }
}

public class MaintenanceRecord : BusinessEntity
{
    public Guid Id { get; set; }
    public required string MachineId { get; set; }
    public MaintenanceType Type { get; set; }
    public required string Description { get; set; }
    public string? PerformedBy { get; set; }
    public DateTime PerformedUtc { get; set; }
    public double DurationHours { get; set; }
    public string? Outcome { get; set; }
}

public class ProductionBatch : BusinessEntity
{
    public Guid Id { get; set; }
    public required string BatchCode { get; set; }
    public required string ProductLine { get; set; }
    public string? PressMachineId { get; set; }
    public DateTime StartedUtc { get; set; }
    public DateTime? CompletedUtc { get; set; }
    public int UnitsProduced { get; set; }
    public int UnitsRejected { get; set; }
}

/// <summary>Append-only audit trail (logins, writes, assistant tool calls).</summary>
public class AuditLogEntry
{
    public Guid Id { get; set; }
    public DateTime TimestampUtc { get; set; }
    public string? UserName { get; set; }
    public required string Action { get; set; }
    public string? EntityId { get; set; }
    public string? DetailsJson { get; set; }
}
