namespace TileTwin.Domain;

public enum DataOrigin { Synthetic, Real }

public enum MachineStatus { Normal, Warning, Critical, Offline, Unknown }

public enum MaintenanceStatus { InService, MaintenanceScheduled, UnderMaintenance, OutOfService }

public enum MaintenanceType { Preventive, Corrective, Inspection }

public enum ObservationPriority { Low, Medium, High, Critical }

public enum ObservationStatus { Open, InProgress, Resolved, Closed }

public enum ObservationCategory { Safety, Housekeeping, Equipment, Quality, Environmental }

public enum CorrectiveActionStatus { Planned, InProgress, Done, Cancelled }

public enum AlertSeverity { Warning, Critical }

public enum AlertStatus { Open, Acknowledged, Resolved }

public static class Roles
{
    public const string Viewer = "Viewer";
    public const string Inspector = "Inspector";
    public const string MaintenanceEngineer = "MaintenanceEngineer";
    public const string Admin = "Admin";

    public static readonly string[] All = [Viewer, Inspector, MaintenanceEngineer, Admin];
}
