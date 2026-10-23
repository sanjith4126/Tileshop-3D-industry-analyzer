namespace TileTwin.Domain.Entities;

public enum WorkflowStatus { Running, Succeeded, Failed }

/// <summary>Audit record of one workflow run (input, status, structured output, user, timing, error).</summary>
public class WorkflowExecution
{
    public Guid Id { get; set; }
    public required string Type { get; set; }
    public required string InputJson { get; set; }
    public WorkflowStatus Status { get; set; }
    public string? OutputJson { get; set; }
    public string? UserName { get; set; }
    public DateTime StartedUtc { get; set; }
    public DateTime? CompletedUtc { get; set; }
    public string? Error { get; set; }
}
