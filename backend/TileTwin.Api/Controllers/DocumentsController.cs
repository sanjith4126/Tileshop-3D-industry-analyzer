using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TileTwin.Api.Services;
using TileTwin.Api.Security;
using TileTwin.Domain;
using TileTwin.Infrastructure.Llm;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api/documents")]
public class DocumentsController(KnowledgeService knowledge, IEmbeddingProvider embeddings) : ControllerBase
{

    [HttpGet, RequirePermission(Permissions.KnowledgeView)]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(new
    {
        searchMode = embeddings.IsConfigured ? $"semantic search ({embeddings.Name})" : KnowledgeService.KeywordMode,
        documents = await knowledge.ListAsync(ct),
    });

    [HttpGet("search"), RequirePermission(Permissions.KnowledgeView)]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int limit = 10, CancellationToken ct = default) =>
        string.IsNullOrWhiteSpace(q) ? ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["q"] = ["Enter search text"] }))
            : Ok(await knowledge.SearchAsync(q, limit, ct));

    /// <summary>Upload PDF / TXT / MD (max 10 MB, validated by content).</summary>
    [HttpPost, RequirePermission(Permissions.KnowledgeManage), EnableRateLimiting("upload"), Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("long"), RequestSizeLimit(KnowledgeService.MaxBytes + 64 * 1024)]
    public async Task<IActionResult> Upload(IFormFile? file, [FromForm] string? title, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return Bad("No file uploaded");
        if (file.Length > KnowledgeService.MaxBytes) return Bad("File larger than 10 MB");
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        try
        {
            return Ok(await knowledge.UploadAsync(ms.ToArray(), file.FileName, title, User.Identity!.Name!, ct));
        }
        catch (ArgumentException ex)
        {
            return Bad(ex.Message);
        }
        catch (Exception ex) when (ex.GetType().Namespace?.StartsWith("UglyToad") == true)
        {
            return Bad("The PDF could not be read.");
        }
    }

    [HttpPost("{id:guid}/reindex"), RequirePermission(Permissions.KnowledgeManage)]
    public async Task<IActionResult> Reindex(Guid id, CancellationToken ct) =>
        await knowledge.ReindexAsync(id, User.Identity!.Name!, ct) is { } d ? Ok(d) : NotFound();

    [HttpDelete("{id:guid}"), RequirePermission(Permissions.KnowledgeManage)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        await knowledge.DeleteAsync(id, User.Identity!.Name!, ct) ? NoContent() : NotFound();

    IActionResult Bad(string message) => ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["file"] = [message] }));
}
