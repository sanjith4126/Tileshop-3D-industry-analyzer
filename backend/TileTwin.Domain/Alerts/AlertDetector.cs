namespace TileTwin.Domain.Alerts;

public sealed record SensorLimits(double? WarningMin, double? WarningMax, double? CriticalMin, double? CriticalMax);

public sealed record AlertCandidate(string MachineId, string SensorId, AlertSeverity Severity, double ObservedValue, double Threshold, DateTime DetectedUtc);

/// <summary>
/// Threshold alert rules. A reading beyond a limit opens an alert of that severity unless an alert for the
/// same machine + sensor + severity is still open (Open or Acknowledged). Only a human resolves an alert.
/// </summary>
public sealed class AlertDetector
{
    readonly HashSet<(string, string, AlertSeverity)> _open;

    public AlertDetector(IEnumerable<(string MachineId, string SensorId, AlertSeverity Severity)> openAlerts) =>
        _open = openAlerts.Select(a => (a.MachineId, a.SensorId, a.Severity)).ToHashSet();

    public static (AlertSeverity Severity, double Threshold)? Classify(double value, SensorLimits l)
    {
        if (l.CriticalMax is { } cMax && value > cMax) return (AlertSeverity.Critical, cMax);
        if (l.CriticalMin is { } cMin && value < cMin) return (AlertSeverity.Critical, cMin);
        if (l.WarningMax is { } wMax && value > wMax) return (AlertSeverity.Warning, wMax);
        if (l.WarningMin is { } wMin && value < wMin) return (AlertSeverity.Warning, wMin);
        return null;
    }

    /// <summary>Returns a new alert to open, or null if within limits or already open.</summary>
    public AlertCandidate? Observe(string machineId, string sensorId, SensorLimits limits, double value, DateTime timestampUtc)
    {
        if (Classify(value, limits) is not { } hit) return null;
        if (!_open.Add((machineId, sensorId, hit.Severity))) return null;
        return new AlertCandidate(machineId, sensorId, hit.Severity, value, hit.Threshold, timestampUtc);
    }
}
