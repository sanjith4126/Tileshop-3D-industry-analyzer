using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Domain.Inspections;

namespace TileTwin.Tests.Domain;

public class InspectionSummaryBuilderTests
{
    static readonly DateTime Now = new(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc);

    static InspectionObservation Obs(ObservationPriority p, ObservationStatus s, ObservationCategory c = ObservationCategory.Safety,
        int daysAgo = 1, string? machine = null, params CorrectiveAction[] actions) => new()
    {
        Id = Guid.NewGuid(), ZoneId = "ZONE-X", MachineId = machine, Priority = p, Status = s, Category = c,
        Description = $"{p} {s}", CreatedUtc = Now.AddDays(-daysAgo), DataOrigin = DataOrigin.Synthetic,
        CorrectiveActions = [.. actions],
    };

    [Fact]
    public void Empty_scope_produces_valid_summary()
    {
        var s = InspectionSummaryBuilder.Build("Zone X", [], Now);
        Assert.Equal(0, s.Total);
        Assert.Contains("no inspection observations recorded", s.Lines[0]);
        Assert.Empty(s.FocusEntityIds);
    }

    [Fact]
    public void Counts_statuses_and_lists_open_high_priority_with_codes()
    {
        var crit = Obs(ObservationPriority.Critical, ObservationStatus.InProgress, machine: "MACHINE-A");
        var high = Obs(ObservationPriority.High, ObservationStatus.Open, daysAgo: 5);
        var closedHigh = Obs(ObservationPriority.High, ObservationStatus.Closed);
        var low = Obs(ObservationPriority.Low, ObservationStatus.Open, ObservationCategory.Housekeeping);

        var s = InspectionSummaryBuilder.Build("Zone X", [crit, high, closedHigh, low], Now);

        Assert.Equal(4, s.Total);
        Assert.Equal(2, s.ByStatus[ObservationStatus.Open]);
        Assert.Equal([crit.Id, high.Id], s.OpenHighPriority.Select(h => h.Id));        // critical first, closed excluded
        Assert.Contains(InspectionSummaryBuilder.Code(crit.Id), s.Lines[1]);
        Assert.Contains($"address critical item(s) {InspectionSummaryBuilder.Code(crit.Id)}", string.Join(" ", s.Lines));
        Assert.Contains($"Oldest open item: {InspectionSummaryBuilder.Code(high.Id)}", string.Join(" ", s.Lines));
        Assert.Equal(["MACHINE-A", "ZONE-X"], s.FocusEntityIds);
        Assert.Contains("SYNTHETIC DEMO DATA", s.Lines[^1]);
    }

    [Fact]
    public void Records_created_by_users_are_labelled_synthetic_too()
    {
        // Classification is set at plant level: an observation a user adds to the demo plant is synthetic demo data.
        var o = Obs(ObservationPriority.High, ObservationStatus.Open);
        o.DataOrigin = DataOrigin.Real;
        var s = InspectionSummaryBuilder.Build("Zone X", [o], Now);
        Assert.Equal("SYNTHETIC", s.DataClassification);
        Assert.Contains("SYNTHETIC DEMO DATA", s.Lines[^1]);
    }

    [Fact]
    public void Overdue_counts_only_unfinished_actions_past_due()
    {
        var overdue = new CorrectiveAction { Description = "a", Status = CorrectiveActionStatus.Planned, DueUtc = Now.AddDays(-1) };
        var doneLate = new CorrectiveAction { Description = "b", Status = CorrectiveActionStatus.Done, DueUtc = Now.AddDays(-1) };
        var future = new CorrectiveAction { Description = "c", Status = CorrectiveActionStatus.InProgress, DueUtc = Now.AddDays(1) };

        var s = InspectionSummaryBuilder.Build("Zone X", [Obs(ObservationPriority.Medium, ObservationStatus.Open, actions: [overdue, doneLate, future])], Now);

        Assert.Equal(1, s.OverdueActions);
    }
}
