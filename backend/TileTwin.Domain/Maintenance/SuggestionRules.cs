namespace TileTwin.Domain.Maintenance;

public enum SignalKind { High, Low, Rising, Falling, Missing, MlAnomaly }

/// <summary>What was observed on one sensor (or the ML model) that may warrant an inspection.</summary>
public sealed record Signal(string SensorSuffix, string Measurement, SignalKind Kind, string Evidence);

public sealed record Suggestion(string RuleId, string Action, string Trigger);

/// <summary>
/// Documented rule table (docs/MAINTENANCE-RULES.md) mapping observed signals to inspection actions.
/// Suggestions only — they require review by a qualified engineer. No automatic equipment control.
/// </summary>
public static class SuggestionRules
{
    public sealed record Rule(string Id, string[] Suffixes, SignalKind[] Kinds, string Action);

    static readonly SignalKind[] Up = [SignalKind.High, SignalKind.Rising];
    static readonly SignalKind[] Down = [SignalKind.Low, SignalKind.Falling];
    static readonly SignalKind[] Either = [SignalKind.High, SignalKind.Rising, SignalKind.Low, SignalKind.Falling];

    public static readonly Rule[] Table =
    [
        new("R-VIB-01", ["VIB"], Up, "Check mounting bolts, base frame and foundation for looseness"),
        new("R-VIB-02", ["VIB"], Up, "Inspect bearings: temperature, noise and lubrication condition"),
        new("R-VIB-03", ["VIB"], Up, "Check alignment and balance of rotating or reciprocating parts (guides, couplings)"),
        new("R-TMP-01", ["TEMP"], Up, "Check lubricant / hydraulic oil level and condition"),
        new("R-TMP-02", ["TEMP"], Up, "Check cooler, fan and filters for blockage; verify cooling flow"),
        new("R-PRS-01", ["PRES"], Either, "Check relief and control valves and seals for leakage or sticking"),
        new("R-PRS-02", ["PRES"], Either, "Verify pressure transmitter calibration against a reference gauge"),
        new("R-FLW-01", ["FLOW"], Down, "Check suction strainer, impeller and for air ingress or cavitation"),
        new("R-CUR-01", ["CURR"], Up, "Check for mechanical overload or binding; check supply voltage balance"),
        new("R-SPD-01", ["SPEED"], Either, "Check belt tension, drive and gearbox"),
        new("R-CYC-01", ["CYCLE"], Up, "Check hydraulic response and valve timing; review recent recipe changes"),
        new("R-RAT-01", ["RATE"], Down, "Check upstream feed and inspection camera / lighting condition"),
        new("R-DAT-01", ["*"], [SignalKind.Missing], "Check sensor wiring, power and transmitter — missing data prevents assessment"),
        new("R-ML-01", ["*"], [SignalKind.MlAnomaly], "Review recent operating changes and compare with similar machines (statistical anomaly, cause unknown)"),
    ];

    public static List<Suggestion> For(IEnumerable<Signal> signals)
    {
        var result = new List<Suggestion>();
        foreach (var s in signals)
            foreach (var r in Table.Where(r => r.Kinds.Contains(s.Kind) && (r.Suffixes.Contains("*") || r.Suffixes.Contains(s.SensorSuffix))))
                if (result.All(x => x.RuleId != r.Id))
                    result.Add(new Suggestion(r.Id, r.Action, $"{s.Measurement}: {s.Evidence}"));
        return result;
    }
}
