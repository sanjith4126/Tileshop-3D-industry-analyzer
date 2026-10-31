using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Workflows;

/// <summary>Common workflow contract: typed input, the data sources (tools) it may use, structured output.</summary>
public interface IWorkflow
{
    string Type { get; }
    string Description { get; }
    JsonElement InputSchema { get; }
    IReadOnlyList<string> AllowedTools { get; }
    Task<object> RunAsync(JsonElement input, string user, CancellationToken ct);
}

public sealed record WorkflowExecutionDto(Guid Id, string Type, WorkflowStatus Status, string? UserName, DateTime StartedUtc,
    DateTime? CompletedUtc, string? Error, JsonElement Input, JsonElement? Output)
{
    public string DataClassification => PlantData.Classification;
}

/// <summary>Runs a workflow and records it in WorkflowExecutions + AuditLog, whatever the outcome.</summary>
public class WorkflowRunner(IEnumerable<IWorkflow> workflows, TileTwinDbContext db, AuditLogger audit, TimeProvider clock, ILogger<WorkflowRunner> log)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    public IEnumerable<IWorkflow> All => workflows;

    public async Task<WorkflowExecutionDto?> RunAsync(string type, JsonElement input, string user, CancellationToken ct)
    {
        var wf = workflows.FirstOrDefault(w => w.Type == type);
        if (wf is null) return null;
        var exec = new WorkflowExecution
        {
            Id = Guid.NewGuid(), Type = type, InputJson = input.GetRawText(), Status = WorkflowStatus.Running,
            UserName = user, StartedUtc = clock.GetUtcNow().UtcDateTime,
        };
        db.WorkflowExecutions.Add(exec);
        await db.SaveChangesAsync(ct);

        try
        {
            var output = await wf.RunAsync(input, user, ct);
            exec.OutputJson = JsonSerializer.Serialize(output, Json);
            exec.Status = WorkflowStatus.Succeeded;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError(ex, "Workflow {Type} failed", type);
            exec.Status = WorkflowStatus.Failed;
            exec.Error = ex is ArgumentException ? ex.Message : "Internal error (see server log)";
        }
        exec.CompletedUtc = clock.GetUtcNow().UtcDateTime;
        audit.Add(user, $"workflow.{type}", exec.Id.ToString(), new { exec.Status });
        await db.SaveChangesAsync(ct);
        return ToDto(exec);
    }

    public async Task<List<WorkflowExecutionDto>> ListAsync(int limit, CancellationToken ct) =>
        (await db.WorkflowExecutions.AsNoTracking().OrderByDescending(e => e.StartedUtc).Take(Math.Clamp(limit, 1, 100)).ToListAsync(ct))
        .Select(ToDto).ToList();

    public async Task<WorkflowExecutionDto?> GetAsync(Guid id, CancellationToken ct) =>
        await db.WorkflowExecutions.AsNoTracking().FirstOrDefaultAsync(e => e.Id == id, ct) is { } e ? ToDto(e) : null;

    static WorkflowExecutionDto ToDto(WorkflowExecution e) => new(e.Id, e.Type, e.Status, e.UserName, e.StartedUtc, e.CompletedUtc, e.Error,
        JsonDocument.Parse(e.InputJson).RootElement.Clone(), e.OutputJson is null ? null : JsonDocument.Parse(e.OutputJson).RootElement.Clone());
}
