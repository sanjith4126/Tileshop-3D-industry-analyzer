namespace TileTwin.Domain.Entities;

public enum TileResultStatus { Classified, ModelNotConfigured, MlUnavailable, Failed }

/// <summary>One uploaded tile image and its classification outcome (never a made-up result).</summary>
public class TileInspection : BusinessEntity
{
    public Guid Id { get; set; }
    public required string OriginalFileName { get; set; }
    public required string StoredFileName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }
    public string? UploadedBy { get; set; }
    public DateTime UploadedUtc { get; set; }
    public TileResultStatus Outcome { get; set; }
    public string? Label { get; set; }
    public double? Confidence { get; set; }
    public string? ProbabilitiesJson { get; set; }
    public string? ModelName { get; set; }
    public string? ModelVersion { get; set; }
    public string? Message { get; set; }
}
