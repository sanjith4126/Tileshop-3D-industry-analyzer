namespace TileTwin.Domain.Entities;

/// <summary>Rule-based threshold alert (deterministic). Not an ML anomaly and not a confirmed fault.</summary>
public class Alert : BusinessEntity
{
    public Guid Id { get; set; }
    public required string MachineId { get; set; }
    public required string SensorId { get; set; }
    public AlertSeverity Severity { get; set; }
    public double ObservedValue { get; set; }
    public double Threshold { get; set; }
    public DateTime DetectedUtc { get; set; }
    public AlertStatus Status { get; set; }
    public DateTime? ResolvedUtc { get; set; }
    public List<AlertAcknowledgement> History { get; set; } = [];
}

/// <summary>Human action on an alert (acknowledge / resolve). Always user-created.</summary>
public class AlertAcknowledgement : BusinessEntity
{
    public Guid Id { get; set; }
    public Guid AlertId { get; set; }
    public AlertStatus NewStatus { get; set; }
    public required string UserName { get; set; }
    public string? Comment { get; set; }
    public DateTime TimestampUtc { get; set; }
}
