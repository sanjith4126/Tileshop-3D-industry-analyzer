using System.Text;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Domain.Knowledge;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Llm;
using UglyToad.PdfPig;

namespace TileTwin.Api.Services;

public sealed record DocumentDto(Guid Id, string Title, string FileName, string ContentType, long SizeBytes, string? UploadedBy, DateTime UploadedUtc,
    DocumentStatus Status, string? Error, int ChunkCount, bool Embedded, DateTime? IndexedUtc, DataOrigin DataOrigin);

public sealed record SearchHit(Guid DocumentId, string DocumentTitle, int ChunkIndex, string Snippet, double Score);

public sealed record SearchResult(string Mode, string Query, IReadOnlyList<SearchHit> Hits);

/// <summary>Knowledge Centre: extract → chunk → (embed if configured) → search with source attribution.</summary>
public class KnowledgeService(TileTwinDbContext db, IEmbeddingProvider embeddings, AuditLogger audit, TimeProvider clock, ILogger<KnowledgeService> log)
{
    public const long MaxBytes = 10 * 1024 * 1024;
    public const int MaxTextChars = 2_000_000;
    public const string KeywordMode = "keyword search (embeddings not configured)";

    sealed record Row(Guid DocumentId, string Title, int Index, string Snippet, double Score);

    /// <summary>Type from content: PDF magic bytes, otherwise strict UTF-8 text without NUL bytes (.txt / .md only).</summary>
    public static (string ContentType, string Text)? Extract(byte[] bytes, string fileName)
    {
        if (bytes.Length >= 5 && Encoding.ASCII.GetString(bytes, 0, 5) == "%PDF-")
        {
            using var pdf = PdfDocument.Open(bytes);
            return ("application/pdf", string.Join("\n\n", pdf.GetPages().Select(p => p.Text)));
        }
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (ext is not (".txt" or ".md") || Array.IndexOf(bytes, (byte)0) >= 0) return null;
        try
        {
            var text = new UTF8Encoding(false, throwOnInvalidBytes: true).GetString(bytes);
            return (ext == ".md" ? "text/markdown" : "text/plain", text);
        }
        catch (DecoderFallbackException)
        {
            return null;
        }
    }

    public async Task<DocumentDto> UploadAsync(byte[] bytes, string fileName, string? title, string user, CancellationToken ct)
    {
        var name = Path.GetFileName(fileName ?? "").Trim();
        var extracted = Extract(bytes, name) ?? throw new ArgumentException("Only PDF, TXT or MD files are accepted (checked by content).");
        if (extracted.Text.Length > MaxTextChars) throw new ArgumentException("Document text is too long (over 2 million characters).");
        if (string.IsNullOrWhiteSpace(extracted.Text)) throw new ArgumentException("No text could be extracted (scanned PDFs need OCR first).");

        var doc = new Document
        {
            Id = Guid.NewGuid(), Title = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(name) : title.Trim()[..Math.Min(200, title.Trim().Length)],
            FileName = name.Length > 200 ? name[..200] : name, ContentType = extracted.ContentType, SizeBytes = bytes.Length,
            UploadedBy = user, UploadedUtc = clock.GetUtcNow().UtcDateTime, ExtractedText = extracted.Text, DataOrigin = DataOrigin.Real,
        };
        db.Documents.Add(doc);
        await IndexAsync(doc, ct);
        audit.Add(user, "document.upload", doc.Id.ToString(), new { doc.FileName, doc.ChunkCount, doc.Status });
        await db.SaveChangesAsync(ct);
        return ToDto(doc);
    }

    /// <summary>(Re)builds chunks and, when configured, embeddings. Caller saves.</summary>
    public async Task IndexAsync(Document doc, CancellationToken ct)
    {
        await db.DocumentChunks.Where(c => c.DocumentId == doc.Id).ExecuteDeleteAsync(ct);
        var texts = TextChunker.Chunk(doc.ExtractedText);
        var chunks = texts.Select((t, i) => new DocumentChunk
        {
            Id = Guid.NewGuid(), DocumentId = doc.Id, Index = i, Text = t, DataOrigin = doc.DataOrigin, SeedBatchId = doc.SeedBatchId,
        }).ToList();
        db.DocumentChunks.AddRange(chunks);
        doc.ChunkCount = chunks.Count;
        doc.Embedded = false;
        doc.Status = DocumentStatus.Indexed;
        doc.Error = null;
        if (embeddings.IsConfigured && chunks.Count > 0)
        {
            try
            {
                var vectors = await embeddings.EmbedAsync(texts, ct);
                for (var i = 0; i < chunks.Count; i++) db.Entry(chunks[i]).Property("Embedding").CurrentValue = new Vector(vectors[i]);
                doc.Embedded = true;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                log.LogWarning(ex, "Embedding failed for document {Id}; keyword search still works", doc.Id);
                doc.Error = "Embedding failed; keyword search only.";
            }
        }
        doc.IndexedUtc = clock.GetUtcNow().UtcDateTime;
    }

    public async Task<DocumentDto?> ReindexAsync(Guid id, string user, CancellationToken ct)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null) return null;
        await IndexAsync(doc, ct);
        audit.Add(user, "document.reindex", id.ToString());
        await db.SaveChangesAsync(ct);
        return ToDto(doc);
    }

    public async Task<bool> DeleteAsync(Guid id, string user, CancellationToken ct)
    {
        var doc = await db.Documents.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null) return false;
        await db.DocumentChunks.Where(c => c.DocumentId == id).ExecuteDeleteAsync(ct);
        db.Documents.Remove(doc);
        audit.Add(user, "document.delete", id.ToString(), new { doc.FileName });
        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<DocumentDto>> ListAsync(CancellationToken ct) =>
        (await db.Documents.AsNoTracking().OrderByDescending(d => d.UploadedUtc).Take(200).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<SearchResult> SearchAsync(string query, int limit, CancellationToken ct)
    {
        query = query.Trim();
        if (query.Length > 200) query = query[..200];
        limit = Math.Clamp(limit, 1, 20);

        if (embeddings.IsConfigured && await db.DocumentChunks.AnyAsync(c => EF.Property<Vector?>(c, "Embedding") != null, ct))
        {
            var q = new Vector((await embeddings.EmbedAsync([query], ct))[0]);
            var rows = await db.Database.SqlQuery<Row>($"""
                SELECT c."DocumentId", d."Title", c."Index", left(c."Text", 400) AS "Snippet", 1 - (c."Embedding" <=> {q}) AS "Score"
                FROM "DocumentChunks" c JOIN "Documents" d ON d."Id" = c."DocumentId"
                WHERE c."Embedding" IS NOT NULL
                ORDER BY c."Embedding" <=> {q} LIMIT {limit}
                """).ToListAsync(ct);
            return new SearchResult($"semantic search ({embeddings.Name})", query, rows.Select(ToHit).ToList());
        }

        var hits = await db.Database.SqlQuery<Row>($"""
            SELECT c."DocumentId", d."Title", c."Index",
                   ts_headline('english', c."Text", q, 'MaxWords=40, MinWords=15, StartSel=«, StopSel=»') AS "Snippet",
                   ts_rank(c."SearchVector", q)::float8 AS "Score"
            FROM "DocumentChunks" c JOIN "Documents" d ON d."Id" = c."DocumentId",
                 websearch_to_tsquery('english', {query}) q
            WHERE c."SearchVector" @@ q
            ORDER BY "Score" DESC, d."Title", c."Index" LIMIT {limit}
            """).ToListAsync(ct);
        return new SearchResult(KeywordMode, query, hits.Select(ToHit).ToList());
    }

    static SearchHit ToHit(Row r) => new(r.DocumentId, r.Title, r.Index, r.Snippet, Math.Round(r.Score, 4));

    static DocumentDto ToDto(Document d) => new(d.Id, d.Title, d.FileName, d.ContentType, d.SizeBytes, d.UploadedBy, d.UploadedUtc,
        d.Status, d.Error, d.ChunkCount, d.Embedded, d.IndexedUtc, d.DataOrigin);
}
