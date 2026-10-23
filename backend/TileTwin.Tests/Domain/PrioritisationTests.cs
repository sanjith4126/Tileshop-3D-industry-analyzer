using TileTwin.Domain;
using TileTwin.Domain.Maintenance;

namespace TileTwin.Tests.Domain;

public class PrioritisationTests
{
    static PriorityInput Input(string id, MachineStatus s = MachineStatus.Normal, int crit = 0, int warn = 0, bool ml = false, int trends = 0, int? days = 5) =>
        new(id, s, crit, warn, ml, trends, days);

    [Fact]
    public void Healthy_recently_inspected_machine_scores_zero_and_is_routine()
    {
        var r = MaintenancePrioritisation.Score(Input("A"));
        Assert.Equal(0, r.Score);
        Assert.Equal("Routine", r.Band);
        Assert.Empty(r.Factors);
    }

    [Fact]
    public void Every_point_is_explained_by_a_factor()
    {
        var r = MaintenancePrioritisation.Score(Input("HP", MachineStatus.Critical, crit: 1, warn: 2, ml: true, trends: 2, days: 40));
        Assert.Equal(40 + 30 + 20 + 25 + 20 + 10, r.Score);
        Assert.Equal(r.Score, r.Factors.Sum(f => f.Points));
        Assert.StartsWith("Immediate", r.Band);
    }

    [Fact]
    public void Caps_limit_alert_and_trend_points()
    {
        var r = MaintenancePrioritisation.Score(Input("A", crit: 5, warn: 5, trends: 9));
        Assert.Equal(80 + 30 + 20, r.Score);
    }

    [Fact]
    public void Missing_data_and_never_inspected_raise_priority()
    {
        var r = MaintenancePrioritisation.Score(Input("P", MachineStatus.Unknown, days: null));
        Assert.Equal(30, r.Score);
        Assert.Equal("Medium — next scheduled window", r.Band);
    }

    [Fact]
    public void Rank_orders_by_score_then_id()
    {
        var ranked = MaintenancePrioritisation.Rank([Input("B", warn: 1), Input("C", crit: 1), Input("A", warn: 1)]);
        Assert.Equal(["C", "A", "B"], ranked.Select(r => r.MachineId));
    }
}
