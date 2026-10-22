using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Configuration;
using TileTwin.Api.Dtos;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api/health")]
public class HealthController(TileTwinDbContext db, AppConfig config, IWebHostEnvironment env) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        bool dbOk;
        try { dbOk = await db.Database.CanConnectAsync(ct); }
        catch { dbOk = false; }
        var demo = dbOk ? await db.DemoState.FindAsync([1], ct) : null;
        return Ok(new
        {
            status = dbOk ? "ok" : "degraded",
            service = "TileTwin.Api",
            database = dbOk ? "ok" : "unavailable",
            demoData = demo is null ? null : new { demo.SeedBatchId, demo.AnchorUtc, demo.SeededUtc },
            features = config.Features(env.IsDevelopment()),
            timestampUtc = DateTime.UtcNow,
        });
    }
}

[ApiController, Route("api/zones")]
public class ZonesController(TileTwinDbContext db, MachineService machines) : ControllerBase
{
    [HttpGet]
    public async Task<List<ZoneDto>> List(CancellationToken ct)
    {
        var zones = await db.Zones.AsNoTracking().OrderBy(z => z.Id).ToListAsync(ct);
        var all = await machines.ListAsync(ct: ct);
        return zones.Select(z =>
        {
            var inZone = all.Where(m => m.ZoneId == z.Id).ToList();
            return new ZoneDto(z.Id, z.Name, z.Description, inZone.Count,
                inZone.GroupBy(m => m.Status).ToDictionary(g => g.Key, g => g.Count()), z.DataOrigin);
        }).ToList();
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        var zone = await db.Zones.AsNoTracking().FirstOrDefaultAsync(z => z.Id == id, ct);
        if (zone is null) return NotFound();
        var list = await machines.ListAsync(id, ct);
        return Ok(new { zone.Id, zone.Name, zone.Description, zone.DataOrigin, machines = list });
    }
}

[ApiController, Route("api/machines")]
public class MachinesController(MachineService machines) : ControllerBase
{
    [HttpGet]
    public async Task<List<MachineSummaryDto>> List([FromQuery] string? zoneId, [FromQuery] MachineStatus? status, CancellationToken ct)
    {
        var list = await machines.ListAsync(zoneId, ct);
        return status is null ? list : list.Where(m => m.Status == status).ToList();
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct) =>
        await machines.GetAsync(id, ct) is { } m ? Ok(m) : NotFound();

    [HttpPut("{id}/state"), Authorize(Roles = $"{Roles.MaintenanceEngineer},{Roles.Admin}")]
    public async Task<IActionResult> UpdateState(string id, UpdateMachineStateRequest req, CancellationToken ct) =>
        await machines.UpdateStateAsync(id, req, User.Identity?.Name, ct) ? NoContent() : NotFound();
}

[ApiController, Route("api/auth")]
public class AuthController(AuthService auth) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req, CancellationToken ct) =>
        await auth.LoginAsync(req, ct) is { } res ? Ok(res) : Unauthorized(new { error = "Invalid email or password" });

    [HttpGet("me"), Authorize]
    public IActionResult Me() => Ok(new
    {
        name = User.Identity?.Name,
        roles = User.FindAll("role").Select(c => c.Value).ToList(),
    });
}
