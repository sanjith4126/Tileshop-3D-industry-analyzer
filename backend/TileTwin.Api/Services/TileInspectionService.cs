using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

public sealed record TileInspectionDto(Guid Id, string OriginalFileName, string ContentType, long SizeBytes, string? UploadedBy, DateTime UploadedUtc,
    TileResultStatus Outcome, string? Label, double? Confidence, IReadOnlyDictionary<string, double>? Probabilities,
    string? ModelName, string? ModelVersion, string? Message, string ImageUrl);

public sealed record TileModelStatusDto(bool MlAvailable, bool Configured, string Status, IReadOnlyList<string>? Labels, JsonElement? ModelCard);

/// <summary>Validates, stores and classifies tile images via the ML service. Never invents a result.</summary>
public class TileInspectionService(TileTwinDbContext db, IHttpClientFactory http, AppStorage storage, AuditLogger audit, TimeProvider clock, ILogger<TileInspectionService> log)
{
    public const long MaxBytes = 10 * 1024 * 1024;
    public const string NotConfigured = "MODEL NOT CONFIGURED";
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Detects the image type from its bytes (not the file name or claimed content type).</summary>
    public static (string ContentType, string Extension)? Sniff(ReadOnlySpan<byte> b)
    {
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return ("image/jpeg", ".jpg");
        if (b.Length >= 8 && b[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return ("image/png", ".png");
        return null;
    }

    public async Task<TileModelStatusDto> StatusAsync(CancellationToken ct)
    {
        try
        {
            var s = await http.CreateClient("ml").GetFromJsonAsync<JsonElement>("/tile/status", ct);
            return new TileModelStatusDto(true, s.GetProperty("configured").GetBoolean(), s.GetProperty("status").GetString() ?? "",
                s.TryGetProperty("labels", out var l) && l.ValueKind == JsonValueKind.Array ? l.EnumerateArray().Select(x => x.GetString()!).ToList() : null,
                s.TryGetProperty("modelCard", out var c) && c.ValueKind == JsonValueKind.Object ? c.Clone() : null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException && !ct.IsCancellationRequested)
        {
            return new TileModelStatusDto(false, false, "ML service unavailable", null, null);
        }
    }

    public async Task<TileInspectionDto> UploadAsync(byte[] bytes, string fileName, string user, CancellationToken ct)
    {
        var kind = Sniff(bytes) ?? throw new ArgumentException("Only JPEG or PNG images are accepted (checked by file content).");
        var id = Guid.NewGuid();
        var stored = id.ToString("N") + kind.Extension;
        await File.WriteAllBytesAsync(Path.Combine(storage.TileDirectory, stored), bytes, ct);

        var row = new TileInspection
        {
            Id = id, OriginalFileName = SafeName(fileName), StoredFileName = stored, ContentType = kind.ContentType, SizeBytes = bytes.Length,
            UploadedBy = user, UploadedUtc = clock.GetUtcNow().UtcDateTime, DataOrigin = DataOrigin.Real,
        };
        await ClassifyAsync(row, bytes, ct);
        db.TileInspections.Add(row);
        audit.Add(user, "tile.upload", id.ToString(), new { row.OriginalFileName, row.SizeBytes, row.Outcome, row.Label });
        await db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    async Task ClassifyAsync(TileInspection row, byte[] bytes, CancellationToken ct)
    {
        try
        {
            using var content = new MultipartFormDataContent();
            var file = new ByteArrayContent(bytes);
            file.Headers.ContentType = new MediaTypeHeaderValue(row.ContentType);
            content.Add(file, "file", row.StoredFileName);
            using var res = await http.CreateClient("ml").PostAsync("/tile/classify", content, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (res.StatusCode == HttpStatusCode.ServiceUnavailable)
            {
                row.Outcome = TileResultStatus.ModelNotConfigured;
                row.Message = body.Contains(NotConfigured) ? ExtractDetail(body) : NotConfigured;
                return;
            }
            if (!res.IsSuccessStatusCode)
            {
                row.Outcome = TileResultStatus.Failed;
                row.Message = $"Classification failed ({(int)res.StatusCode})";
                return;
            }
            var r = JsonDocument.Parse(body).RootElement;
            row.Outcome = TileResultStatus.Classified;
            row.Label = r.GetProperty("label").GetString();
            row.Confidence = r.GetProperty("confidence").GetDouble();
            row.ProbabilitiesJson = r.GetProperty("probabilities").GetRawText();
            row.ModelName = r.GetProperty("modelName").GetString();
            row.ModelVersion = r.GetProperty("modelVersion").GetString();
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            log.LogWarning("ML service unavailable for tile classification: {Message}", ex.Message);
            row.Outcome = TileResultStatus.MlUnavailable;
            row.Message = "ML service unavailable — image stored, not classified";
        }
    }

    static string ExtractDetail(string body)
    {
        try { return JsonDocument.Parse(body).RootElement.GetProperty("detail").GetProperty("error").GetString() ?? NotConfigured; }
        catch { return NotConfigured; }
    }

    static string SafeName(string name)
    {
        var n = Path.GetFileName(name ?? "").Trim();
        n = new string(n.Where(c => !char.IsControl(c)).ToArray());
        return string.IsNullOrEmpty(n) ? "upload" : n.Length > 200 ? n[..200] : n;
    }

    public async Task<List<TileInspectionDto>> ListAsync(CancellationToken ct) =>
        (await db.TileInspections.AsNoTracking().OrderByDescending(t => t.UploadedUtc).Take(50).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<TileInspectionDto?> GetAsync(Guid id, CancellationToken ct) =>
        await db.TileInspections.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct) is { } t ? ToDto(t) : null;

    public async Task<(string Path, string ContentType)?> ImageAsync(Guid id, CancellationToken ct)
    {
        var t = await db.TileInspections.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (t is null) return null;
        var path = Path.Combine(storage.TileDirectory, t.StoredFileName);
        return File.Exists(path) ? (path, t.ContentType) : null;
    }

    static TileInspectionDto ToDto(TileInspection t) => new(t.Id, t.OriginalFileName, t.ContentType, t.SizeBytes, t.UploadedBy, t.UploadedUtc,
        t.Outcome, t.Label, t.Confidence, t.ProbabilitiesJson is null ? null : JsonSerializer.Deserialize<Dictionary<string, double>>(t.ProbabilitiesJson, Json),
        t.ModelName, t.ModelVersion, t.Message, $"/api/tile-inspections/{t.Id}/image");
}

/// <summary>Where uploaded files live (UPLOADS_PATH, default App_Data/uploads under the API content root).</summary>
public sealed class AppStorage
{
    public AppStorage(string root)
    {
        TileDirectory = Path.Combine(root, "tiles");
        Directory.CreateDirectory(TileDirectory);
    }

    public string TileDirectory { get; }
}
