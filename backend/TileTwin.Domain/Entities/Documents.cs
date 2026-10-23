namespace TileTwin.Domain.Entities;

public enum DocumentStatus { Indexed, Failed }

/// <summary>Knowledge Centre document. The extracted text is kept so the document can be re-indexed.</summary>
public class Document : BusinessEntity
{
    public Guid Id { get; set; }
    public required string Title { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }
    public string? UploadedBy { get; set; }
    public DateTime UploadedUtc { get; set; }
    public DocumentStatus Status { get; set; }
    public string? Error { get; set; }
    public required string ExtractedText { get; set; }
    public int ChunkCount { get; set; }
    public bool Embedded { get; set; }
    public DateTime? IndexedUtc { get; set; }
}

/// <summary>
/// A searchable piece of a document. The database adds two shadow columns: a generated full-text
/// "SearchVector" (tsvector) and a nullable pgvector "Embedding" (filled only when embeddings are configured).
/// </summary>
public class DocumentChunk : BusinessEntity
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public int Index { get; set; }
    public required string Text { get; set; }
}
