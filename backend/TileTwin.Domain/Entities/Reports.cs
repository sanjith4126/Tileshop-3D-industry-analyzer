namespace TileTwin.Domain.Entities;

public enum ReportType { FactoryHealth, MachineAnomalies, MaintenanceHistory, SiteInspection, MaintenancePrioritisation }

public enum ReportStatus { Draft, Final }

/// <summary>A generated report. Content is a structured JSON document rendered to HTML (browser) or PDF.</summary>
public class Report : BusinessEntity
{
    public Guid Id { get; set; }
    public ReportType Type { get; set; }
    public ReportStatus Status { get; set; }
    public required string Title { get; set; }
    public required string ParametersJson { get; set; }
    public required string ContentJson { get; set; }
    public DateTime GeneratedUtc { get; set; }
    public string? GeneratedBy { get; set; }
}
