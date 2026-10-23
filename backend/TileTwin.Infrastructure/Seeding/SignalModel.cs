namespace TileTwin.Infrastructure.Seeding;

/// <summary>
/// Generates synthetic sensor values. Shared by the seeder (history) and the live simulator so
/// scripted patterns continue after startup. "Anchor" is the time the demo batch was seeded.
/// Scripted patterns (see docs/DEMO-SCRIPT.md):
///  - MACHINE-HP-002: vibration and oil temperature drift upward over the 24 h before the anchor.
///  - MACHINE-PUMP-002: flow sensor stops reporting 45 min before the anchor (status Unknown).
///  - MACHINE-CONV-003: no readings for the 3 h before the anchor and flagged offline.
/// </summary>
public static class SignalModel
{
    public const string DriftMachine = "MACHINE-HP-002";
    public const string GapMachine = "MACHINE-PUMP-002";
    public const string GapSensorSuffix = "FLOW";
    public const string OfflineMachine = "MACHINE-CONV-003";

    public static readonly TimeSpan DriftWindow = TimeSpan.FromHours(24);
    public static readonly TimeSpan GapBeforeAnchor = TimeSpan.FromMinutes(45);
    public static readonly TimeSpan OfflineBeforeAnchor = TimeSpan.FromHours(3);

    public static bool HasReading(string machineId, string suffix, DateTime t, DateTime anchor) =>
        machineId switch
        {
            OfflineMachine => t < anchor - OfflineBeforeAnchor,
            GapMachine when suffix == GapSensorSuffix => t < anchor - GapBeforeAnchor,
            _ => true,
        };

    /// <summary>Live simulator: the PUMP-002 flow gap continues; offline machines are skipped via their flag.</summary>
    public static bool HasLiveReading(string machineId, string suffix) =>
        !(machineId == GapMachine && suffix == GapSensorSuffix);

    public static double Value(string machineId, DemoPlant.SensorSpec s, DateTime t, DateTime anchor, Random rng)
    {
        var v = s.Nominal + Gaussian(rng) * s.Noise;

        if (s.Unit == "°C")
            v += s.Nominal * 0.02 * Math.Sin(2 * Math.PI * t.TimeOfDay.TotalHours / 24);

        if (machineId == DriftMachine)
        {
            // Progress through the drift window; capped so the live simulator cannot run away forever.
            var p = Math.Clamp((t - (anchor - DriftWindow)) / DriftWindow, 0, 1.25);
            if (s.Suffix == "VIB") v += 6.0 * Math.Pow(p, 1.5);   // warning ~10.5 h, critical ~2.5 h before anchor
            if (s.Suffix == "TEMP") v += 18.0 * p;               // warning ~4 h before anchor
        }

        return Math.Round(Math.Max(0, v), 3);
    }

    static double Gaussian(Random rng)
    {
        var u1 = 1.0 - rng.NextDouble();
        var u2 = rng.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2 * Math.PI * u2);
    }
}
