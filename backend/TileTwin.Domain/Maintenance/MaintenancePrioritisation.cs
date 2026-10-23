namespace TileTwin.Domain.Maintenance;

public sealed record PriorityInput(
    string MachineId, MachineStatus Status, int OpenCriticalAlerts, int OpenWarningAlerts,
    bool FreshMlAnomaly, int NotableTrends, int? DaysSinceInspectionOrCorrective);

public sealed record PriorityFactor(string Factor, int Points);

public sealed record PriorityResult(string MachineId, int Score, string Band, IReadOnlyList<PriorityFactor> Factors);

/// <summary>
/// Documented scoring rule (docs/MAINTENANCE-RULES.md § Maintenance prioritisation). Deterministic and explainable:
/// every point comes with the factor that produced it.
/// </summary>
public static class MaintenancePrioritisation
{
    public const int NoRecentCareDays = 30;

    public static PriorityResult Score(PriorityInput i)
    {
        var f = new List<PriorityFactor>();
        void Add(string factor, int points) { if (points > 0) f.Add(new(factor, points)); }

        Add($"{i.OpenCriticalAlerts} open critical alert(s) × 40 (max 80)", Math.Min(80, 40 * i.OpenCriticalAlerts));
        Add($"{i.OpenWarningAlerts} open warning alert(s) × 15 (max 30)", Math.Min(30, 15 * i.OpenWarningAlerts));
        Add("Status Critical", i.Status == MachineStatus.Critical ? 20 : 0);
        Add("Status Warning", i.Status == MachineStatus.Warning ? 10 : 0);
        Add("Status Unknown (missing data)", i.Status == MachineStatus.Unknown ? 20 : 0);
        Add("Fresh ML statistical anomaly", i.FreshMlAnomaly ? 25 : 0);
        Add($"{i.NotableTrends} notable 24 h trend(s) × 10 (max 20)", Math.Min(20, 10 * i.NotableTrends));
        Add($"No inspection or corrective work in {NoRecentCareDays} days",
            i.DaysSinceInspectionOrCorrective is null or > NoRecentCareDays ? 10 : 0);

        var score = f.Sum(x => x.Points);
        return new PriorityResult(i.MachineId, score, Band(score), f);
    }

    public static string Band(int score) => score switch
    {
        >= 80 => "Immediate — inspect this shift",
        >= 40 => "High — plan within 24 h",
        >= 15 => "Medium — next scheduled window",
        _ => "Routine",
    };

    public static List<PriorityResult> Rank(IEnumerable<PriorityInput> inputs) =>
        inputs.Select(Score).OrderByDescending(r => r.Score).ThenBy(r => r.MachineId, StringComparer.Ordinal).ToList();
}
