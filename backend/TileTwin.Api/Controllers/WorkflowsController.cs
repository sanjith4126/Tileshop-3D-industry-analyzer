using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TileTwin.Api.Security;
using TileTwin.Api.Workflows;
using TileTwin.Domain;

namespace TileTwin.Api.Controllers;

/// <summary>The maintenance-prioritisation workflow: a priority ranking (Appendix B "Anomaly scores and priority ranking").</summary>
[ApiController, Route("api/workflows"), RequirePermission(Permissions.AnomaliesView)]
public class WorkflowsController(WorkflowRunner runner) : ControllerBase
{
    [HttpGet]
    public IActionResult List() => Ok(runner.All.Select(w => new { w.Type, w.Description, w.InputSchema, w.AllowedTools }));

    /// <summary>Run a workflow. Any signed-in role.</summary>
    [HttpPost("{type}"), Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("long")]
    public async Task<IActionResult> Run(string type, [FromBody] JsonElement input, CancellationToken ct) =>
        await runner.RunAsync(type, input, User.Identity!.Name!, ct) is { } r ? Ok(r) : NotFound();

    [HttpGet("executions")]
    public Task<List<WorkflowExecutionDto>> Executions([FromQuery] int limit = 20, CancellationToken ct = default) => runner.ListAsync(limit, ct);

    [HttpGet("executions/{id:guid}")]
    public async Task<IActionResult> Execution(Guid id, CancellationToken ct) =>
        await runner.GetAsync(id, ct) is { } r ? Ok(r) : NotFound();
}
