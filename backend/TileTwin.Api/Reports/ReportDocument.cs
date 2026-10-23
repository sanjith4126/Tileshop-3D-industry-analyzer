using System.ComponentModel.DataAnnotations;
using TileTwin.Domain.Entities;

namespace TileTwin.Api.Reports;

public sealed record ReportTable(IReadOnlyList<string> Columns, IReadOnlyList<IReadOnlyList<string>> Rows);

public sealed record ReportSection(string Heading, IReadOnlyList<string> Paragraphs, ReportTable? Table = null);

/// <summary>Renderer-agnostic report content (shown as HTML in the browser and rendered to PDF).</summary>
public sealed record ReportDocument(
    string Title, ReportType Type, DateTime GeneratedUtc, DateTime FromUtc, DateTime ToUtc,
    IReadOnlyDictionary<string, string> Filters,
    IReadOnlyList<string> Summary,
    IReadOnlyList<ReportSection> Sections,
    IReadOnlyList<string> Recommendations,
    string DataSource,
    bool ContainsSyntheticData);

public sealed record ReportRequest(
    [Required] ReportType? Type,
    DateTime? FromUtc,
    DateTime? ToUtc,
    [MaxLength(64)] string? MachineId,
    [MaxLength(64)] string? ZoneId,
    ReportStatus Status = ReportStatus.Final);

public sealed record ReportListItem(Guid Id, ReportType Type, ReportStatus Status, string Title, DateTime GeneratedUtc, string? GeneratedBy);

public sealed record ReportDto(Guid Id, ReportStatus Status, string? GeneratedBy, ReportDocument Document);
