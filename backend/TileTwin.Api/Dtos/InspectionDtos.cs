using System.ComponentModel.DataAnnotations;
using TileTwin.Domain;

namespace TileTwin.Api.Dtos;

public sealed record InspectionZoneDto(string Id, string Name, int Total, int Open, int OpenHighPriority)
{
    public string DataClassification => PlantData.Classification;
}

public sealed record ObservationSummaryDto(
    Guid Id, string Code, string ZoneId, string ZoneName, string? MachineId,
    ObservationCategory Category, ObservationPriority Priority, ObservationStatus Status, string Description,
    string? AssignedRole, string? AssignedUser, DateTime CreatedUtc, DateTime UpdatedUtc, int OpenActions, DataOrigin DataOrigin)
{
    public string DataClassification => PlantData.Classification;
}

public sealed record CorrectiveActionDto(Guid Id, string Description, CorrectiveActionStatus Status, string? AssignedRole,
    DateTime CreatedUtc, DateTime? DueUtc, DateTime? CompletedUtc, bool Overdue);

public sealed record AttachmentDto(Guid Id, string FileName, string Caption, bool IsPlaceholder, string Url);

public sealed record ObservationEventDto(DateTime TimestampUtc, string UserName, string Action, string? Details);

public sealed record ObservationDetailDto(
    ObservationSummaryDto Observation, string InspectionTitle, string? InspectorName, DateTime InspectionUtc,
    IReadOnlyList<CorrectiveActionDto> CorrectiveActions, IReadOnlyList<AttachmentDto> Attachments, IReadOnlyList<ObservationEventDto> History)
{
    public string DataClassification => PlantData.Classification;
}

public sealed record UpdateObservationRequest(
    ObservationStatus? Status,
    [MaxLength(64)] string? AssignedRole,
    [MaxLength(256)] string? AssignedUser,
    [MaxLength(1000)] string? Comment);

public sealed record InspectionSummaryRequest([MaxLength(64)] string? ZoneId);
