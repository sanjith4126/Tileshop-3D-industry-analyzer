using System.ComponentModel.DataAnnotations;
using TileTwin.Domain;

namespace TileTwin.Api.Dtos;

/// <summary>One time bucket. Count 0 means no readings: the values are null and the bucket is a gap (never filled).</summary>
public sealed record SeriesPoint(DateTime T, double? Avg, double? Min, double? Max, int Count);

public sealed record SensorSeriesDto(
    string SensorId, string Measurement, string Unit,
    double? WarningMin, double? WarningMax, double? CriticalMin, double? CriticalMax,
    IReadOnlyList<SeriesPoint> Points);

public sealed record ReadingsResponse(
    string MachineId, string Range, DateTime FromUtc, DateTime ToUtc, int BucketSeconds,
    DataOrigin DataOrigin, IReadOnlyList<SensorSeriesDto> Sensors)
{
    public string DataClassification => PlantData.Classification;
}

public sealed record AlertHistoryDto(AlertStatus NewStatus, string UserName, string? Comment, DateTime TimestampUtc);

public sealed record AlertDto(
    Guid Id, string MachineId, string MachineName, string SensorId, string Measurement, string Unit,
    AlertSeverity Severity, double ObservedValue, double Threshold, DateTime DetectedUtc,
    AlertStatus Status, DateTime? ResolvedUtc, DataOrigin DataOrigin, IReadOnlyList<AlertHistoryDto> History)
{
    public string DataClassification => PlantData.Classification;
}

public sealed record AlertActionRequest([MaxLength(500)] string? Comment);

public sealed record SimulatorStateDto(bool Paused, DateTime? AnchorUtc, DateTime? LastReadingUtc);

public sealed record SimulatorUpdateRequest(bool Paused);
