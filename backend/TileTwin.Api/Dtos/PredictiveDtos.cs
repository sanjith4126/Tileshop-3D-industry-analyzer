using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Domain.Maintenance;

namespace TileTwin.Api.Dtos;

public sealed record AnomalyScoreDto(
    double Score, double Threshold, double? MaxFeatureZ, double? ZThreshold, bool IsAnomaly, string ModelVersion,
    DateTime TimestampUtc, IReadOnlyList<MlDeviation> TopDeviations, bool IsFresh);

/// <summary>FirstHourAvg / LastHourAvg are observed averages; Trend is a least-squares fit used to judge direction.</summary>
public sealed record SensorTrendDto(string SensorId, string Measurement, string Unit, string State, Trend? Trend, double? FirstHourAvg, double? LastHourAvg);

public sealed record MlStatusDto(bool Available, string Message, DateTime? LastCheckedUtc);

public sealed record PredictiveDto(
    MachineSummaryDto Machine,
    MlStatusDto Ml,
    AnomalyScoreDto? LatestScore,
    IReadOnlyList<AnomalyScoreDto> ScoreHistory,
    IReadOnlyList<SensorTrendDto> Trends,
    IReadOnlyList<string> PatternsObserved,
    IReadOnlyList<Suggestion> SuggestedActions,
    IReadOnlyList<string> DataQualityWarnings,
    IReadOnlyList<AlertDto> OpenAlerts,
    IReadOnlyList<MaintenanceRecordDto> MaintenanceHistory,
    string ReviewLabel,
    string FailurePrediction);

public sealed record PredictiveListItem(string MachineId, string Name, MachineStatus Status, AnomalyScoreDto? LatestScore);

public sealed record ScoreResultDto(string MachineId, AnomalyScoreDto? Score, bool MlUnavailable, string? Problem);
