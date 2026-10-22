namespace TileTwin.Domain.Entities;

/// <summary>Every business row records where it came from so demo data can be reset safely.</summary>
public abstract class BusinessEntity
{
    public DataOrigin DataOrigin { get; set; } = DataOrigin.Real;
    public string? SeedBatchId { get; set; }
}
