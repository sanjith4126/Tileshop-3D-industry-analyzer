using TileTwin.Domain;
using TileTwin.Domain.Status;

namespace TileTwin.Tests.Domain;

public class MachineStatusCalculatorTests
{
    static readonly DateTime Now = new(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);

    static SensorState Sensor(string id, double? value, DateTime? ts, bool required = true,
        double? wMin = null, double? wMax = 10, double? cMin = null, double? cMax = 20) =>
        new(id, id, required, wMin, wMax, cMin, cMax, value, ts);

    static MachineStatusResult Eval(params SensorState[] s) => MachineStatusCalculator.Evaluate(false, s, Now);

    [Fact]
    public void All_recent_and_within_limits_is_Normal()
    {
        var r = Eval(Sensor("a", 5, Now.AddMinutes(-1)), Sensor("b", 9.9, Now));
        Assert.Equal(MachineStatus.Normal, r.Status);
        Assert.Empty(r.Reasons);
    }

    [Fact]
    public void Value_above_warning_max_is_Warning() =>
        Assert.Equal(MachineStatus.Warning, Eval(Sensor("a", 10.5, Now), Sensor("b", 5, Now)).Status);

    [Fact]
    public void Value_above_critical_max_is_Critical() =>
        Assert.Equal(MachineStatus.Critical, Eval(Sensor("a", 25, Now), Sensor("b", 11, Now)).Status);

    [Fact]
    public void Low_limits_are_respected()
    {
        Assert.Equal(MachineStatus.Warning, Eval(Sensor("flow", 25, Now, wMin: 30, wMax: null, cMin: 20, cMax: null)).Status);
        Assert.Equal(MachineStatus.Critical, Eval(Sensor("flow", 15, Now, wMin: 30, wMax: null, cMin: 20, cMax: null)).Status);
    }

    [Fact]
    public void Value_exactly_on_limit_is_not_beyond_it() =>
        Assert.Equal(MachineStatus.Normal, Eval(Sensor("a", 10, Now)).Status);

    [Fact]
    public void Flagged_offline_wins_over_everything() =>
        Assert.Equal(MachineStatus.Offline,
            MachineStatusCalculator.Evaluate(true, [Sensor("a", 25, Now)], Now).Status);

    [Fact]
    public void No_sensors_or_no_readings_is_Offline()
    {
        Assert.Equal(MachineStatus.Offline, MachineStatusCalculator.Evaluate(false, [], Now).Status);
        Assert.Equal(MachineStatus.Offline, Eval(Sensor("a", null, null), Sensor("b", null, null)).Status);
    }

    [Fact]
    public void No_reading_from_any_sensor_for_more_than_5_minutes_is_Offline() =>
        Assert.Equal(MachineStatus.Offline, Eval(Sensor("a", 5, Now.AddMinutes(-6)), Sensor("b", 5, Now.AddMinutes(-10))).Status);

    [Fact]
    public void Missing_required_sensor_is_Unknown_never_Normal()
    {
        var r = Eval(Sensor("a", 5, Now), Sensor("b", null, null));
        Assert.Equal(MachineStatus.Unknown, r.Status);
        Assert.Contains(r.Reasons, x => x.Contains("no recent reading"));
    }

    [Fact]
    public void Stale_required_sensor_is_Unknown_and_its_old_value_is_ignored()
    {
        // b's last value was critical but 30 min old: it is missing data, not a current critical.
        var r = Eval(Sensor("a", 5, Now), Sensor("b", 99, Now.AddMinutes(-30)));
        Assert.Equal(MachineStatus.Unknown, r.Status);
    }

    [Fact]
    public void Missing_optional_sensor_does_not_affect_status() =>
        Assert.Equal(MachineStatus.Normal, Eval(Sensor("a", 5, Now), Sensor("b", null, null, required: false)).Status);

    [Fact]
    public void Critical_is_not_hidden_by_missing_data()
    {
        var r = Eval(Sensor("a", 25, Now), Sensor("b", null, null));
        Assert.Equal(MachineStatus.Critical, r.Status);
        Assert.Contains(r.Reasons, x => x.Contains("no recent reading"));
    }

    [Fact]
    public void Missing_data_outranks_warning() =>
        Assert.Equal(MachineStatus.Unknown, Eval(Sensor("a", 11, Now), Sensor("b", null, null)).Status);

    [Fact]
    public void Open_anomaly_raises_Normal_to_Warning()
    {
        var r = MachineStatusCalculator.Evaluate(false, [Sensor("a", 5, Now)], Now, hasOpenAnomaly: true);
        Assert.Equal(MachineStatus.Warning, r.Status);
        Assert.Contains(r.Reasons, x => x.Contains("not a confirmed fault"));
    }
}
