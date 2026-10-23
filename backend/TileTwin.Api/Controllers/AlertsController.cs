using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Seeding;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api/alerts")]
public class AlertsController(AlertService alerts) : ControllerBase
{
    /// <summary>Threshold alerts. Without <c>status</c> returns all not-resolved alerts.</summary>
    [HttpGet]
    public Task<List<AlertDto>> List([FromQuery] string? machineId, [FromQuery] AlertStatus? status, [FromQuery] int limit = 100, CancellationToken ct = default) =>
        alerts.ListAsync(machineId, status, limit, ct);

    [HttpPost("{id:guid}/acknowledge"), Authorize(Roles = $"{Roles.Inspector},{Roles.MaintenanceEngineer},{Roles.Admin}")]
    public Task<IActionResult> Acknowledge(Guid id, AlertActionRequest req, CancellationToken ct) => Apply(id, AlertStatus.Acknowledged, req, ct);

    [HttpPost("{id:guid}/resolve"), Authorize(Roles = $"{Roles.MaintenanceEngineer},{Roles.Admin}")]
    public Task<IActionResult> Resolve(Guid id, AlertActionRequest req, CancellationToken ct) => Apply(id, AlertStatus.Resolved, req, ct);

    async Task<IActionResult> Apply(Guid id, AlertStatus status, AlertActionRequest req, CancellationToken ct)
    {
        var (result, dto) = await alerts.ApplyAsync(id, status, User.Identity!.Name!, req.Comment, ct);
        return result switch
        {
            AlertService.ActionResult.Ok => Ok(dto),
            AlertService.ActionResult.NotFound => NotFound(),
            _ => Conflict(new { error = $"Alert cannot move to {status} from its current status" }),
        };
    }
}

[ApiController, Route("api/admin/simulator")]
public class SimulatorController(TileTwinDbContext db, AuditLogger audit) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var state = await db.DemoState.AsNoTracking().SingleOrDefaultAsync(ct);
        var probe = DemoPlant.Machines[0];
        var last = await db.SensorReadings.Where(r => r.MachineId == probe.Id && r.SensorId == DemoPlant.SensorId(probe.Id, probe.Sensors[0].Suffix))
            .MaxAsync(r => (DateTime?)r.TimestampUtc, ct);
        return Ok(new SimulatorStateDto(state?.SimulatorPaused ?? false, state?.AnchorUtc, last));
    }

    [HttpPut, Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Put(SimulatorUpdateRequest req, CancellationToken ct)
    {
        var state = await db.DemoState.SingleOrDefaultAsync(ct);
        if (state is null) return Conflict(new { error = "Demo data not seeded" });
        state.SimulatorPaused = req.Paused;
        audit.Add(User.Identity!.Name, req.Paused ? "simulator.pause" : "simulator.resume", null);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
