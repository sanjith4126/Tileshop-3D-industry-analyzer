using TileTwin.Domain;
using TileTwin.Domain.Alerts;

namespace TileTwin.Tests.Domain;

public class AlertDetectorTests
{
    static readonly SensorLimits Vib = new(null, 4.5, null, 7.1);
    static readonly SensorLimits Flow = new(30, null, 20, null);
    static readonly DateTime T0 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Within_limits_creates_nothing() =>
        Assert.Null(new AlertDetector([]).Observe("M", "S", Vib, 4.5, T0));

    [Fact]
    public void Crossing_warning_creates_warning_with_threshold_and_value()
    {
        var a = new AlertDetector([]).Observe("M", "S", Vib, 5.0, T0);
        Assert.Equal(new AlertCandidate("M", "S", AlertSeverity.Warning, 5.0, 4.5, T0), a);
    }

    [Fact]
    public void Low_limits_trigger_alerts()
    {
        Assert.Equal(AlertSeverity.Warning, new AlertDetector([]).Observe("M", "S", Flow, 25, T0)!.Severity);
        Assert.Equal((AlertSeverity.Critical, 20.0), AlertDetector.Classify(15, Flow));
    }

    [Fact]
    public void Same_machine_sensor_severity_is_not_duplicated_while_open()
    {
        var d = new AlertDetector([]);
        Assert.NotNull(d.Observe("M", "S", Vib, 5.0, T0));
        Assert.Null(d.Observe("M", "S", Vib, 5.5, T0.AddMinutes(1)));
        Assert.Null(d.Observe("M", "S", Vib, 4.0, T0.AddMinutes(2)));   // back in limits
        Assert.Null(d.Observe("M", "S", Vib, 6.0, T0.AddMinutes(3)));   // still open -> no new alert
    }

    [Fact]
    public void Escalation_to_critical_opens_a_separate_critical_alert()
    {
        var d = new AlertDetector([]);
        Assert.Equal(AlertSeverity.Warning, d.Observe("M", "S", Vib, 5.0, T0)!.Severity);
        Assert.Equal(AlertSeverity.Critical, d.Observe("M", "S", Vib, 7.5, T0.AddMinutes(1))!.Severity);
    }

    [Fact]
    public void Existing_open_alerts_from_the_database_suppress_new_ones()
    {
        var d = new AlertDetector([("M", "S", AlertSeverity.Critical)]);
        Assert.Null(d.Observe("M", "S", Vib, 8, T0));
        Assert.NotNull(d.Observe("M", "OTHER", Vib, 8, T0));
        Assert.NotNull(d.Observe("M2", "S", Vib, 8, T0));
    }
}
