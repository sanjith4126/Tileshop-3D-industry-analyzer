using TileTwin.Domain.Entities;

namespace TileTwin.Domain.Inspections;

public sealed record SummaryItem(string Code, Guid Id, string ZoneId, string? MachineId, ObservationPriority Priority, ObservationStatus Status, string Description);

public sealed record InspectionSummary(
    string Scope, DateTime GeneratedUtc, int Total,
    IReadOnlyDictionary<ObservationStatus, int> ByStatus,
    IReadOnlyDictionary<ObservationPriority, int> OpenByPriority,
    IReadOnlyList<SummaryItem> OpenHighPriority,
    int OverdueActions,
    IReadOnlyList<string> Lines,
    IReadOnlyList<string> FocusEntityIds)
{
    public string DataClassification => PlantData.Classification;
}

/// <summary>
/// Deterministic inspection summary computed from records only (no LLM). Every statement cites record codes.
/// "Open" here means not Resolved/Closed (i.e. Open or InProgress).
/// </summary>
public static class InspectionSummaryBuilder
{
    public static string Code(Guid id) => "OBS-" + id.ToString("N")[..6].ToUpperInvariant();

    public static bool IsOpen(ObservationStatus s) => s is ObservationStatus.Open or ObservationStatus.InProgress;

    public static InspectionSummary Build(string scope, IReadOnlyList<InspectionObservation> obs, DateTime nowUtc)
    {
        var open = obs.Where(o => IsOpen(o.Status)).ToList();
        var high = open.Where(o => o.Priority >= ObservationPriority.High)
            .OrderByDescending(o => o.Priority).ThenBy(o => o.CreatedUtc)
            .Select(o => new SummaryItem(Code(o.Id), o.Id, o.ZoneId, o.MachineId, o.Priority, o.Status, o.Description)).ToList();
        var overdue = obs.SelectMany(o => o.CorrectiveActions)
            .Count(a => a.DueUtc < nowUtc && a.Status is CorrectiveActionStatus.Planned or CorrectiveActionStatus.InProgress);
        int Count(ObservationStatus s) => obs.Count(o => o.Status == s);

        var lines = new List<string>();
        if (obs.Count == 0)
        {
            lines.Add($"{scope}: no inspection observations recorded.");
        }
        else
        {
            lines.Add($"{scope}: {obs.Count} observation(s) — {Count(ObservationStatus.Open)} open, {Count(ObservationStatus.InProgress)} in progress, " +
                      $"{Count(ObservationStatus.Resolved)} resolved, {Count(ObservationStatus.Closed)} closed.");
            lines.Add(high.Count == 0
                ? "No open high or critical priority observations."
                : $"{high.Count} open high/critical priority: " + string.Join(" | ", high.Select(h => $"{h.Code} [{h.Priority}] {Shorten(h.Description)}")));
            if (open.Count > 0)
            {
                var topCat = open.GroupBy(o => o.Category).OrderByDescending(g => g.Count()).ThenBy(g => g.Key).First();
                lines.Add($"Most frequent category among open items: {topCat.Key} ({topCat.Count()} of {open.Count}).");
                var oldest = open.MinBy(o => o.CreatedUtc)!;
                lines.Add($"Oldest open item: {Code(oldest.Id)}, raised {(nowUtc - oldest.CreatedUtc).TotalDays:0.#} day(s) ago.");
            }
            lines.Add(overdue == 0 ? "No overdue corrective actions." : $"{overdue} corrective action(s) are past their due date and not done.");

            var critical = high.Where(h => h.Priority == ObservationPriority.Critical).ToList();
            lines.Add(critical.Count > 0
                ? $"Recommendation: address critical item(s) {string.Join(", ", critical.Select(c => c.Code))} first, then remaining high-priority items."
                : high.Count > 0 ? $"Recommendation: review high-priority item(s) {string.Join(", ", high.Select(h => h.Code))} at the next walk-down."
                : "Recommendation: continue routine inspections.");
        }

        lines.Add($"Source: {obs.Count} inspection record(s) of the demonstration plant — SYNTHETIC DEMO DATA. Generated deterministically from records.");

        var focus = high.Select(h => h.MachineId ?? h.ZoneId).Distinct().ToList();
        return new InspectionSummary(scope, nowUtc, obs.Count,
            Enum.GetValues<ObservationStatus>().ToDictionary(s => s, Count),
            Enum.GetValues<ObservationPriority>().ToDictionary(p => p, p => open.Count(o => o.Priority == p)),
            high, overdue, lines, focus);
    }

    static string Shorten(string s) => s.Length <= 70 ? s.TrimEnd('.') : s[..67].TrimEnd(' ', ',', '.', ';') + "…";
}
