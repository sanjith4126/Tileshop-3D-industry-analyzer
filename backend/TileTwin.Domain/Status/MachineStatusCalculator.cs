namespace TileTwin.Domain.Status;

public sealed record SensorState(
    string SensorId,
    string Measurement,
    bool IsRequired,
    double? WarningMin, double? WarningMax,
    double? CriticalMin, double? CriticalMax,
    double? LatestValue,
    DateTime? LatestTimestampUtc);

public sealed record MachineStatusResult(MachineStatus Status, IReadOnlyList<string> Reasons);

/// <summary>
/// Precedence: Offline, Critical, Unknown, Warning, Normal.
/// Critical ranks above Unknown so a critical value is never hidden by another sensor's missing data.
/// Missing required data is never reported as Normal.
/// </summary>
public static class MachineStatusCalculator
{
    public static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(5);

    public static MachineStatusResult Evaluate(
        bool flaggedOffline, IReadOnlyCollection<SensorState> sensors, DateTime nowUtc, bool hasOpenAnomaly = false)
    {
        if (flaggedOffline)
            return new(MachineStatus.Offline, ["Machine is flagged offline"]);

        var newest = sensors.Count == 0 ? null : sensors.Max(s => s.LatestTimestampUtc);
        if (newest is null || nowUtc - newest.Value > StaleAfter)
            return new(MachineStatus.Offline, [$"No reading from any sensor for more than {StaleAfter.TotalMinutes:0} min"]);

        var critical = new List<string>();
        var warning = new List<string>();
        var missing = new List<string>();

        foreach (var s in sensors)
        {
            var recent = s.LatestValue is not null && s.LatestTimestampUtc is not null
                         && nowUtc - s.LatestTimestampUtc.Value <= StaleAfter;
            if (!recent)
            {
                if (s.IsRequired) missing.Add($"{s.Measurement}: no recent reading");
                continue;
            }

            var v = s.LatestValue!.Value;
            if (Beyond(v, s.CriticalMin, s.CriticalMax))
                critical.Add($"{s.Measurement} {v:0.##} beyond critical limit");
            else if (Beyond(v, s.WarningMin, s.WarningMax))
                warning.Add($"{s.Measurement} {v:0.##} beyond warning limit");
        }

        if (hasOpenAnomaly) warning.Add("Open ML anomaly (statistical, not a confirmed fault)");

        if (critical.Count > 0) return new(MachineStatus.Critical, [.. critical, .. missing, .. warning]);
        if (missing.Count > 0) return new(MachineStatus.Unknown, [.. missing, .. warning]);
        if (warning.Count > 0) return new(MachineStatus.Warning, warning);
        return new(MachineStatus.Normal, []);
    }

    public static bool Beyond(double value, double? min, double? max) =>
        (min is not null && value < min) || (max is not null && value > max);
}
