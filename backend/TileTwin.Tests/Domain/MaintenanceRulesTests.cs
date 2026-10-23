using TileTwin.Domain.Maintenance;

namespace TileTwin.Tests.Domain;

public class MaintenanceRulesTests
{
    static readonly DateTime T0 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    static List<(DateTime, double)> Series(Func<int, double> f, int n = 48) =>
        Enumerable.Range(0, n).Select(i => (T0.AddMinutes(30 * i), f(i))).ToList();

    [Fact]
    public void Linear_rise_is_notable_with_correct_slope()
    {
        var t = TrendAnalyzer.Analyze(Series(i => 2.0 + 0.1 * i))!;   // +0.1 per 30 min = +0.2 per hour
        Assert.Equal(0.2, t.SlopePerHour, 6);
        Assert.True(t.Notable);
        Assert.Equal("rising", t.Direction);
    }

    [Fact]
    public void Small_wobble_is_stable() =>
        Assert.Equal("stable", TrendAnalyzer.Analyze(Series(i => 180 + (i % 2 == 0 ? 1 : -1)))!.Direction);

    [Fact]
    public void Too_few_points_gives_no_trend() =>
        Assert.Null(TrendAnalyzer.Analyze(Series(i => i, 2)));

    [Fact]
    public void Vibration_high_maps_to_mounting_bearing_alignment_rules()
    {
        var s = SuggestionRules.For([new Signal("VIB", "Vibration", SignalKind.High, "8 mm/s")]);
        Assert.Equal(["R-VIB-01", "R-VIB-02", "R-VIB-03"], s.Select(x => x.RuleId));
        Assert.All(s, x => Assert.Contains("Vibration", x.Trigger));
    }

    [Fact]
    public void Low_flow_and_missing_data_and_ml_anomaly_rules()
    {
        var s = SuggestionRules.For([
            new Signal("FLOW", "Flow", SignalKind.Low, "25"),
            new Signal("PRES", "Pressure", SignalKind.Missing, "none"),
            new Signal("VIB", "Vibration", SignalKind.MlAnomaly, "score"),
        ]);
        Assert.Equal(["R-FLW-01", "R-DAT-01", "R-ML-01"], s.Select(x => x.RuleId));
    }

    [Fact]
    public void Rising_flow_does_not_trigger_low_flow_rule_and_duplicates_collapse()
    {
        Assert.Empty(SuggestionRules.For([new Signal("FLOW", "Flow", SignalKind.Rising, "+")]));
        var s = SuggestionRules.For([new Signal("TEMP", "T", SignalKind.High, "a"), new Signal("TEMP", "T", SignalKind.Rising, "b")]);
        Assert.Equal(2, s.Count);
    }
}
