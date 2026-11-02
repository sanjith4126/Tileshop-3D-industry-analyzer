using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TileTwin.Api.Reports;
using TileTwin.Api.Security;
using TileTwin.Domain;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api/reports"), RequirePermission(Permissions.ReportsGenerate)]
public class ReportsController(ReportService reports, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public Task<List<ReportListItem>> List(CancellationToken ct) => reports.ListAsync(ct);

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        await reports.GetAsync(id, ct) is { } r ? Ok(r) : NotFound();

    /// <summary>Generates and stores a report. Any signed-in role.</summary>
    [HttpPost, Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("long")]
    public async Task<IActionResult> Create(ReportRequest req, CancellationToken ct)
    {
        if (ReportService.Validate(req, clock.GetUtcNow().UtcDateTime) is { } error)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["period"] = [error] }));
        var r = await reports.CreateAsync(req, User.Identity!.Name!, ct);
        return CreatedAtAction(nameof(Get), new { id = r.Id }, r);
    }

    [HttpGet("{id:guid}/pdf"), Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("long")]
    public async Task<IActionResult> Pdf(Guid id, CancellationToken ct)
    {
        if (await reports.GetAsync(id, ct) is not { } r) return NotFound();
        var name = $"tiletwin-{r.Document.Type.ToString().ToLowerInvariant()}-{r.Document.GeneratedUtc:yyyyMMdd-HHmm}.pdf";
        return File(PdfRenderer.Render(r.Document), "application/pdf", name);
    }
}
