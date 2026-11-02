using System.ComponentModel.DataAnnotations;
using TileTwin.Domain;

namespace TileTwin.Api.Dtos;

public sealed record SensorDto(
    string Id, string Measurement, string Unit, bool IsRequired,
    double? WarningMin, double? WarningMax, double? CriticalMin, double? CriticalMax,
    double? LatestValue, DateTime? LatestTimestampUtc,
    string State); // Normal | Warning | Critical | Missing

public sealed record MachineSummaryDto(
    string Id, string Name, string TypeId, string TypeName, string ZoneId, string ZoneName,
    MachineStatus Status, IReadOnlyList<string> StatusReasons,
    MaintenanceStatus MaintenanceStatus, bool IsFlaggedOffline,
    string Manufacturer, string Model, DataOrigin DataOrigin, DateTime? LastReadingUtc, int OpenAlertCount)
{
    public string DataClassification => PlantData.Classification;
}

public sealed record MaintenanceRecordDto(
    Guid Id, string MachineId, MaintenanceType Type, string Description, string? PerformedBy,
    DateTime PerformedUtc, double DurationHours, string? Outcome, DataOrigin DataOrigin)
{
    public string DataClassification => PlantData.Classification;
}

/// <summary>Snapshot of one machine at GeneratedAt. RecentMaintenance is null for roles that may not view maintenance records.</summary>
public sealed record MachineDetailDto(
    MachineSummaryDto Machine, IReadOnlyList<SensorDto> Sensors, IReadOnlyList<MaintenanceRecordDto>? RecentMaintenance, DateTime GeneratedAt)
{
    public string DataClassification => PlantData.Classification;
}

public sealed record ZoneDto(
    string Id, string Name, string? Description, int MachineCount,
    IReadOnlyDictionary<MachineStatus, int> StatusCounts, DataOrigin DataOrigin)
{
    public string DataClassification => PlantData.Classification;
}

public sealed record UpdateMachineStateRequest(
    [Required] MaintenanceStatus? MaintenanceStatus,
    bool IsFlaggedOffline);

public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(256)] string Password);

/// <summary>Body of sign-in and refresh. Permissions are listed for the UI only; the token itself carries roles, not permissions.</summary>
public sealed record LoginResponse(string Token, DateTime ExpiresUtc, string Email, string? DisplayName, IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions);
