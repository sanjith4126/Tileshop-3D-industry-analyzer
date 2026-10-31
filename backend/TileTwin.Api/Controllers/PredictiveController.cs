using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api")]
public class PredictiveController(PredictiveService predictive, AnomalyScoringService scoring, MlStatus ml, TileTwinDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet("predictive")]
    public Task<List<PredictiveListItem>> List(CancellationToken ct) => predictive.ListAsync(ct);

    [HttpGet("predictive/{machineId}")]
    public async Task<IActionResult> Get(string machineId, CancellationToken ct) =>
        await predictive.GetAsync(machineId, ct) is { } p ? Ok(p) : NotFound();

    /// <summary>Score one machine now. Any signed-in user (rate-limited).</summary>
    [HttpPost("predictive/{machineId}/score"), Authorize, Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("ml")]
    public async Task<IActionResult> Score(string machineId, CancellationToken ct)
    {
        var r = await scoring.ScoreAsync(machineId, ct);
        if (r.Problem == "Unknown machine") return NotFound();
        var now = clock.GetUtcNow().UtcDateTime;
        return Ok(new ScoreResultDto(machineId, r.Score is null ? null : PredictiveService.ToDto(r.Score, now), r.Unavailable, r.Problem));
    }

    [HttpGet("ml/status")]
    public async Task<IActionResult> Status(CancellationToken ct)
    {
        var models = await db.MlModels.AsNoTracking().OrderBy(m => m.Id)
            .Select(m => new { m.Id, m.Version, m.Type, m.MachineType, m.Status, m.TrainedUtc, m.EvaluationSummaryJson, m.DataOrigin })
            .ToListAsync(ct);
        return Ok(new { dataClassification = PlantData.Classification, ml = new MlStatusDto(ml.Available, ml.Message, ml.LastCheckedUtc), models });
    }
}
