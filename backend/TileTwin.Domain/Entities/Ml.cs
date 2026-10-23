namespace TileTwin.Domain.Entities;

/// <summary>Result of one ML scoring call. A statistical anomaly is "unusual", not a confirmed fault.</summary>
public class AnomalyScore : BusinessEntity
{
    public Guid Id { get; set; }
    public required string MachineId { get; set; }
    public required string ModelVersion { get; set; }
    public double Score { get; set; }
    public double Threshold { get; set; }
    public double? MaxFeatureZ { get; set; }
    public double? ZThreshold { get; set; }
    public bool IsAnomaly { get; set; }
    public string? TopDeviationsJson { get; set; }
    public DateTime TimestampUtc { get; set; }
}

/// <summary>Registry of models reported by the ML service.</summary>
public class MlModel : BusinessEntity
{
    public required string Id { get; set; }            // e.g. anomaly-TYPE-PUMP
    public required string Version { get; set; }
    public required string Type { get; set; }
    public string? MachineType { get; set; }
    public required string Status { get; set; }
    public string? EvaluationSummaryJson { get; set; }
    public DateTime? TrainedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
