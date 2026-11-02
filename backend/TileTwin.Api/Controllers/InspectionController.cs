using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TileTwin.Api.Dtos;
using TileTwin.Api.Services;
using TileTwin.Api.Security;
using TileTwin.Domain;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api"), RequirePermission(Permissions.InspectionsView)]
public class InspectionController(InspectionService inspections) : ControllerBase
{
    [HttpGet("inspection/zones")]
    public Task<List<InspectionZoneDto>> Zones(CancellationToken ct) => inspections.ZonesAsync(ct);

    [HttpGet("observations")]
    public Task<List<ObservationSummaryDto>> List([FromQuery] string? zoneId, [FromQuery] ObservationStatus? status,
        [FromQuery] ObservationPriority? priority, [FromQuery] string? q, CancellationToken ct) =>
        inspections.ListAsync(zoneId, status, priority, q?.Length > 100 ? q[..100] : q, ct);

    [HttpGet("observations/{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        await inspections.GetAsync(id, ct) is { } o ? Ok(o) : NotFound();

    [HttpPatch("observations/{id:guid}"), RequirePermission(Permissions.InspectionsPerform, Permissions.InspectionsManage)]
    public async Task<IActionResult> Update(Guid id, UpdateObservationRequest req, CancellationToken ct)
    {
        if (req.AssignedRole is { Length: > 0 } r && !Roles.All.Contains(r))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["assignedRole"] = [$"Must be one of {string.Join(", ", Roles.All)}"] }));
        return await inspections.UpdateAsync(id, req, User.Identity!.Name!, ct) is { } o ? Ok(o) : NotFound();
    }

    /// <summary>Deterministic summary computed from records (no LLM).</summary>
    [HttpPost("inspection/summary")]
    public async Task<IActionResult> Summary(InspectionSummaryRequest req, CancellationToken ct) =>
        await inspections.SummaryAsync(req.ZoneId, ct) is { } s ? Ok(s) : NotFound();

    [HttpGet("observations/attachments/{id:guid}")]
    public async Task<IActionResult> Attachment(Guid id, CancellationToken ct) =>
        await inspections.PlaceholderSvgAsync(id, ct) is { } svg ? Content(svg, "image/svg+xml") : NotFound();
}
