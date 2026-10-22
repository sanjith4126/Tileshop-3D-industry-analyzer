namespace TileTwin.Domain.Entities;

public class Site : BusinessEntity
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public List<Zone> Zones { get; set; } = [];
}

public class Zone : BusinessEntity
{
    public required string Id { get; set; }
    public required string SiteId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public List<Machine> Machines { get; set; } = [];
}

public class MachineType : BusinessEntity
{
    public required string Id { get; set; }
    public required string Name { get; set; }
}

public class Machine : BusinessEntity
{
    public required string Id { get; set; }
    public required string Name { get; set; }
    public required string MachineTypeId { get; set; }
    public MachineType? MachineType { get; set; }
    public required string ZoneId { get; set; }
    public Zone? Zone { get; set; }
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public MaintenanceStatus MaintenanceStatus { get; set; }
    /// <summary>Manually flagged offline (e.g. isolated for work). Forces status Offline.</summary>
    public bool IsOffline { get; set; }
    public List<SensorDefinition> Sensors { get; set; } = [];
}

/// <summary>Limits are illustrative demo values, not equipment specifications.</summary>
public class SensorDefinition : BusinessEntity
{
    public required string Id { get; set; }
    public required string MachineId { get; set; }
    public required string Measurement { get; set; }
    public required string Unit { get; set; }
    public bool IsRequired { get; set; } = true;
    public double? WarningMin { get; set; }
    public double? WarningMax { get; set; }
    public double? CriticalMin { get; set; }
    public double? CriticalMax { get; set; }
}

public class SensorReading : BusinessEntity
{
    public long Id { get; set; }
    public required string MachineId { get; set; }
    public required string SensorId { get; set; }
    public double Value { get; set; }
    public DateTime TimestampUtc { get; set; }
}
