using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TileTwin.Api.Services;
using TileTwin.Domain;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api/tile-inspections")]
public class TileInspectionsController(TileInspectionService tiles) : ControllerBase
{
    [HttpGet("status")]
    public Task<TileModelStatusDto> Status(CancellationToken ct) => tiles.StatusAsync(ct);

    [HttpGet]
    public Task<List<TileInspectionDto>> List(CancellationToken ct) => tiles.ListAsync(ct);

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => await tiles.GetAsync(id, ct) is { } t ? Ok(t) : NotFound();

    [HttpGet("{id:guid}/image")]
    public async Task<IActionResult> Image(Guid id, CancellationToken ct) =>
        await tiles.ImageAsync(id, ct) is { } img ? PhysicalFile(img.Path, img.ContentType) : NotFound();

    /// <summary>Upload a JPEG/PNG (max 10 MB, validated by content). Inspector, MaintenanceEngineer or Admin.</summary>
    [HttpPost, Authorize(Roles = $"{Roles.Inspector},{Roles.MaintenanceEngineer},{Roles.Admin}")]
    [EnableRateLimiting("upload"), RequestSizeLimit(TileInspectionService.MaxBytes + 64 * 1024)]
    public async Task<IActionResult> Upload(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return Problem("file", "No file uploaded");
        if (file.Length > TileInspectionService.MaxBytes) return Problem("file", "File larger than 10 MB");
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        try
        {
            var dto = await tiles.UploadAsync(ms.ToArray(), file.FileName, User.Identity!.Name!, ct);
            return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
        }
        catch (ArgumentException ex)
        {
            return Problem("file", ex.Message);
        }
    }

    IActionResult Problem(string field, string message) =>
        ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { [field] = [message] }));
}
