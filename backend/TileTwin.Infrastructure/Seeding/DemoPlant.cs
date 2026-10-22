namespace TileTwin.Infrastructure.Seeding;

/// <summary>Fixed layout of the fictional TileTwin Demonstration Facility. Values are illustrative.</summary>
public static class DemoPlant
{
    public const string SeedBatchId = "demo-v1";
    public const string SiteId = "SITE-TILETWIN-DEMO";
    public const string SiteName = "TileTwin Demonstration Facility";

    public const string ZoneRaw = "ZONE-RAW-A";
    public const string ZonePress = "ZONE-PRESS-A";
    public const string ZoneKiln = "ZONE-KILN-A";
    public const string ZoneGlaze = "ZONE-GLAZE-A";
    public const string ZoneMaint = "ZONE-MAINT-A";

    public static readonly (string Id, string Name, string Description)[] Zones =
    [
        (ZoneRaw, "Raw Material", "Clay and feldspar intake, milling and slurry preparation"),
        (ZonePress, "Pressing", "Hydraulic presses forming green tiles"),
        (ZoneKiln, "Kiln / Firing", "Roller kiln and drying"),
        (ZoneGlaze, "Glazing & Inspection", "Glaze lines and automated visual inspection"),
        (ZoneMaint, "Maintenance + Storage", "Workshop, spares and finished-goods racking"),
    ];

    public static readonly (string Id, string Name)[] MachineTypes =
    [
        ("TYPE-HYDRAULIC-PRESS", "Hydraulic press"),
        ("TYPE-PUMP", "Pump"),
        ("TYPE-MOTOR", "Electric motor"),
        ("TYPE-CONVEYOR", "Conveyor"),
        ("TYPE-INSPECTION-STATION", "Inspection station"),
    ];

    public sealed record SensorSpec(
        string Suffix, string Measurement, string Unit, double Nominal, double Noise,
        double? WarningMin, double? WarningMax, double? CriticalMin, double? CriticalMax);

    static readonly SensorSpec[] PressSensors =
    [
        new("PRES", "Pressure", "bar", 180, 3, null, 220, null, 240),
        new("TEMP", "Oil temperature", "°C", 45, 0.6, null, 60, null, 70),
        new("VIB", "Vibration", "mm/s", 2.0, 0.15, null, 4.5, null, 7.1),
        new("CYCLE", "Cycle time", "s", 12, 0.2, null, 15, null, 18),
    ];

    static readonly SensorSpec[] PumpSensors =
    [
        new("PRES", "Discharge pressure", "bar", 6, 0.15, 4, 8, 3, 9),
        new("FLOW", "Flow", "m³/h", 40, 0.8, 30, null, 20, null),
        new("VIB", "Vibration", "mm/s", 2.0, 0.15, null, 4.5, null, 7.1),
        new("TEMP", "Temperature", "°C", 50, 0.6, null, 70, null, 80),
    ];

    static readonly SensorSpec[] MotorSensors =
    [
        new("TEMP", "Winding temperature", "°C", 70, 0.8, null, 100, null, 120),
        new("VIB", "Vibration", "mm/s", 1.8, 0.12, null, 4.5, null, 7.1),
        new("CURR", "Current", "A", 45, 0.7, null, 55, null, 62),
    ];

    static readonly SensorSpec[] ConveyorSensors =
    [
        new("SPEED", "Belt speed", "m/s", 1.2, 0.02, 0.9, 1.5, 0.6, 1.8),
        new("TEMP", "Drive temperature", "°C", 55, 0.6, null, 75, null, 90),
    ];

    static readonly SensorSpec[] InspectionSensors =
    [
        new("CYCLE", "Inspection cycle time", "s", 2.5, 0.05, null, 3.5, null, 4.5),
        new("RATE", "Inspection rate", "tiles/min", 24, 0.5, 18, null, 12, null),
    ];

    public sealed record MachineSpec(string Id, string Name, string TypeId, string ZoneId, SensorSpec[] Sensors);

    public static readonly MachineSpec[] Machines =
    [
        new("MACHINE-HP-001", "Hydraulic Press 1", "TYPE-HYDRAULIC-PRESS", ZonePress, PressSensors),
        new("MACHINE-HP-002", "Hydraulic Press 2", "TYPE-HYDRAULIC-PRESS", ZonePress, PressSensors),
        new("MACHINE-HP-003", "Hydraulic Press 3", "TYPE-HYDRAULIC-PRESS", ZonePress, PressSensors),
        new("MACHINE-HP-004", "Hydraulic Press 4", "TYPE-HYDRAULIC-PRESS", ZonePress, PressSensors),
        new("MACHINE-PUMP-001", "Slurry Pump 1", "TYPE-PUMP", ZoneRaw, PumpSensors),
        new("MACHINE-PUMP-002", "Hydraulic Power Unit Pump", "TYPE-PUMP", ZonePress, PumpSensors),
        new("MACHINE-PUMP-003", "Glaze Pump", "TYPE-PUMP", ZoneGlaze, PumpSensors),
        new("MACHINE-MOTOR-001", "Ball Mill Motor", "TYPE-MOTOR", ZoneRaw, MotorSensors),
        new("MACHINE-MOTOR-002", "Kiln Exhaust Fan Motor", "TYPE-MOTOR", ZoneKiln, MotorSensors),
        new("MACHINE-MOTOR-003", "Kiln Roller Drive Motor", "TYPE-MOTOR", ZoneKiln, MotorSensors),
        new("MACHINE-CONV-001", "Conveyor Raw→Press", "TYPE-CONVEYOR", ZoneRaw, ConveyorSensors),
        new("MACHINE-CONV-002", "Conveyor Press→Kiln", "TYPE-CONVEYOR", ZonePress, ConveyorSensors),
        new("MACHINE-CONV-003", "Conveyor Kiln→Glazing", "TYPE-CONVEYOR", ZoneKiln, ConveyorSensors),
        new("MACHINE-CONV-004", "Conveyor Glazing→Storage", "TYPE-CONVEYOR", ZoneGlaze, ConveyorSensors),
        new("MACHINE-INSP-001", "Visual Inspection Station 1", "TYPE-INSPECTION-STATION", ZoneGlaze, InspectionSensors),
        new("MACHINE-INSP-002", "Visual Inspection Station 2", "TYPE-INSPECTION-STATION", ZoneGlaze, InspectionSensors),
    ];

    public static string SensorId(string machineId, string suffix) =>
        $"{machineId.Replace("MACHINE-", "SENSOR-")}-{suffix}";
}
