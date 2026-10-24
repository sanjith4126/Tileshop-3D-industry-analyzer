using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Configuration;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Llm;
using TileTwin.Infrastructure.Seeding;
using TileTwin.Infrastructure.Simulation;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api/admin"), Authorize(Roles = Roles.Admin)]
public class AdminController(UserAdminService userAdmin, TileTwinDbContext db, DemoSeeder seeder, AuditLogger audit, TimeProvider clock) : ControllerBase
{
    [HttpGet("users")]
    public Task<List<UserDto>> Users() => userAdmin.ListAsync();

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(CreateUserRequest req)
    {
        var (user, error) = await userAdmin.CreateAsync(req, User.Identity!.Name!);
        return user is not null ? Ok(user) : Bad("user", error!);
    }

    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(string id, UpdateUserRequest req)
    {
        var (user, error) = await userAdmin.UpdateAsync(id, req, User.Identity!.Name!);
        return user is not null ? Ok(user) : error is null ? NotFound() : Bad("user", error);
    }

    [HttpGet("audit")]
    public async Task<IActionResult> Audit([FromQuery] int limit = 100, CancellationToken ct = default) =>
        Ok(await db.AuditLog.AsNoTracking().OrderByDescending(a => a.TimestampUtc).Take(Math.Clamp(limit, 1, 500)).ToListAsync(ct));

    /// <summary>Deletes only Synthetic rows of the demo batch (in one transaction) and re-seeds. User-created rows are kept.</summary>
    [HttpPost("reset-demo")]
    public async Task<IActionResult> ResetDemo(CancellationToken ct)
    {
        await SimulationEngine.DemoLock.WaitAsync(ct);
        try
        {
            await seeder.ResetAsync(clock.GetUtcNow().UtcDateTime, ct);
        }
        finally
        {
            SimulationEngine.DemoLock.Release();
        }
        audit.Add(User.Identity!.Name, "demo.reset", DemoPlant.SeedBatchId);
        await db.SaveChangesAsync(ct);
        return Ok(new { reset = true, seedBatchId = DemoPlant.SeedBatchId, anchorUtc = (await db.DemoState.AsNoTracking().SingleAsync(ct)).AnchorUtc });
    }

    IActionResult Bad(string key, string message) => ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { [key] = [message] }));
}

/// <summary>Aggregated numbers for the Overview page and configuration status of every optional component.</summary>
[ApiController, Route("api/overview")]
public class OverviewController(MachineService machines, TileTwinDbContext db, AppConfig config, IWebHostEnvironment env,
    MlStatus ml, TileInspectionService tiles, ILlmProvider llm, IEmbeddingProvider embeddings) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var list = await machines.ListAsync(ct: ct);
        var alerts = await db.Alerts.AsNoTracking().Where(a => a.Status != AlertStatus.Resolved).Select(a => a.Severity).ToListAsync(ct);
        var highObs = await db.InspectionObservations.AsNoTracking().CountAsync(o =>
            (o.Status == ObservationStatus.Open || o.Status == ObservationStatus.InProgress)
            && (o.Priority == ObservationPriority.High || o.Priority == ObservationPriority.Critical), ct);
        var latest = await db.AnomalyScores.AsNoTracking().Where(a => a.IsAnomaly).OrderByDescending(a => a.TimestampUtc)
            .Select(a => new { a.MachineId, a.Score, a.Threshold, a.TimestampUtc, a.ModelVersion }).FirstOrDefaultAsync(ct);
        var demo = await db.DemoState.AsNoTracking().SingleOrDefaultAsync(ct);
        var tile = await tiles.StatusAsync(ct);

        return Ok(new
        {
            statusCounts = Enum.GetValues<MachineStatus>().ToDictionary(s => s.ToString(), s => list.Count(m => m.Status == s)),
            openAlerts = new { total = alerts.Count, critical = alerts.Count(s => s == AlertSeverity.Critical) },
            openHighPriorityObservations = highObs,
            latestAnomaly = latest,
            config = new
            {
                ai = llm.IsConfigured,
                ml = new { ml.Available, ml.Message, ml.LastCheckedUtc },
                tileModel = new { tile.Configured, tile.Status },
                knowledgeSearch = embeddings.IsConfigured ? $"semantic ({embeddings.Name})" : "keyword (embeddings not configured)",
                devUsers = config.Features(env.IsDevelopment()).DevUsers,
                simulatorPaused = demo?.SimulatorPaused,
                demoData = demo is null ? null : new { demo.SeedBatchId, demo.AnchorUtc, demo.SeededUtc },
            },
        });
    }
}
