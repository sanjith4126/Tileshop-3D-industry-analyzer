using System.Security.Cryptography;
using System.Text;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using static TileTwin.Infrastructure.Seeding.DemoPlant;
using P = TileTwin.Domain.ObservationPriority;
using S = TileTwin.Domain.ObservationStatus;
using C = TileTwin.Domain.ObservationCategory;

namespace TileTwin.Infrastructure.Seeding;

/// <summary>Hand-written fictional inspection, maintenance and production records, placed relative to the anchor.</summary>
public static class DemoRecords
{
    /// <summary>Stable GUID from a key, so re-seeding produces the same IDs.</summary>
    public static Guid StableGuid(string key) => new(MD5.HashData(Encoding.UTF8.GetBytes(key)));

    // (zone, machine, category, priority, status, round 0=6 days ago / 1=2 days ago, description, actions)
    static readonly (string Zone, string? Machine, C Cat, P Pri, S Status, int Round, string Text, string[] Actions)[] Observations =
    [
        (ZoneGlaze, "MACHINE-PUMP-003", C.Equipment, P.High, S.Open, 1, "Glaze pump seal weeping; glaze residue on floor beneath pump skid.", ["Clean spill and place drip tray", "Replace mechanical seal"]),
        (ZoneGlaze, null, C.Safety, P.Critical, S.InProgress, 1, "Guard on glaze line spray booth door interlock found bypassed with cable tie.", ["Remove bypass and restore interlock", "Toolbox talk on interlock bypass rules"]),
        (ZoneGlaze, "MACHINE-INSP-001", C.Quality, P.High, S.Open, 1, "Inspection camera lens has glaze overspray film; false rejects suspected.", ["Clean lens and verify with reference tiles"]),
        (ZoneGlaze, "MACHINE-INSP-002", C.Quality, P.Medium, S.Resolved, 0, "Reference tile set for station 2 calibration missing two samples.", ["Replace missing reference tiles"]),
        (ZoneGlaze, "MACHINE-CONV-004", C.Housekeeping, P.Low, S.Closed, 0, "Broken tile fragments accumulated under conveyor return run.", ["Clear debris; add to daily cleaning checklist"]),
        (ZoneGlaze, null, C.Environmental, P.Medium, S.Open, 1, "Glaze wash-water sump level high; overflow risk during next wash-down.", ["Arrange sump pump-out"]),
        (ZonePress, "MACHINE-HP-002", C.Equipment, P.High, S.Open, 1, "Operator reports unusual knocking noise from press 2 during compaction stroke.", ["Vibration check by maintenance engineer"]),
        (ZonePress, "MACHINE-HP-001", C.Safety, P.Medium, S.InProgress, 0, "Light curtain on press 1 intermittently trips without obstruction.", ["Clean and realign light curtain", "Monitor trip log for 1 week"]),
        (ZonePress, "MACHINE-PUMP-002", C.Equipment, P.Medium, S.Open, 1, "Flow transmitter junction box lid loose on hydraulic power unit.", ["Inspect wiring and refit lid"]),
        (ZonePress, null, C.Housekeeping, P.Low, S.Resolved, 0, "Spray-dried powder spillage around press hopper walkway.", ["Vacuum walkway; check hopper skirt"]),
        (ZonePress, "MACHINE-HP-004", C.Equipment, P.Low, S.Closed, 0, "Minor hydraulic oil mist at press 4 manifold fitting.", ["Re-torque fitting"]),
        (ZonePress, "MACHINE-CONV-002", C.Safety, P.High, S.Resolved, 0, "Emergency pull-cord on conveyor press→kiln slack and not tested this month.", ["Re-tension pull-cord", "Functional test and record"]),
        (ZoneKiln, "MACHINE-MOTOR-002", C.Equipment, P.Medium, S.Open, 1, "Exhaust fan motor terminal box cover missing one screw.", ["Replace screw"]),
        (ZoneKiln, null, C.Safety, P.High, S.InProgress, 1, "Hot-surface warning sign at kiln entry faded and partly unreadable.", ["Order replacement sign", "Install sign"]),
        (ZoneKiln, "MACHINE-CONV-003", C.Equipment, P.High, S.InProgress, 1, "Conveyor kiln→glazing isolated for gearbox overhaul; temporary manual transfer in use.", ["Gearbox overhaul", "Recommission and test run"]),
        (ZoneKiln, "MACHINE-MOTOR-003", C.Equipment, P.Low, S.Closed, 0, "Roller drive chain guard bolt loose.", ["Tighten bolt"]),
        (ZoneKiln, null, C.Environmental, P.Medium, S.Resolved, 0, "Kiln burner area: combustion air filter differential pressure gauge reading high.", ["Replace filter element"]),
        (ZoneRaw, "MACHINE-PUMP-001", C.Equipment, P.Medium, S.Open, 1, "Slurry pump discharge hose showing abrasion near clamp.", ["Replace hose section"]),
        (ZoneRaw, "MACHINE-MOTOR-001", C.Equipment, P.Low, S.Resolved, 0, "Ball mill motor cooling fins dusty.", ["Clean fins"]),
        (ZoneRaw, null, C.Safety, P.High, S.Open, 1, "Raw material bay walkway marking worn; forklift route unclear.", ["Repaint walkway markings"]),
        (ZoneRaw, "MACHINE-CONV-001", C.Housekeeping, P.Low, S.Closed, 0, "Clay build-up on conveyor raw→press head pulley scraper.", ["Clean scraper; adjust tension"]),
        (ZoneMaint, null, C.Safety, P.Medium, S.Open, 1, "Spare-parts rack beam load label missing on bay 3.", ["Fit load label"]),
        (ZoneMaint, null, C.Housekeeping, P.Low, S.Resolved, 0, "Used oil drums stored outside bunded area.", ["Move drums into bund"]),
        (ZoneMaint, null, C.Safety, P.High, S.Closed, 0, "Workshop grinder tool rest gap above 3 mm.", ["Adjust tool rest", "Add to weekly checks"]),
        (ZoneMaint, null, C.Environmental, P.Low, S.Open, 1, "Finished-goods racking area: shrink-wrap waste bin overflowing.", ["Increase collection frequency"]),
    ];

    public static (List<Inspection> Inspections, List<InspectionObservation> Observations, List<CorrectiveAction> Actions)
        BuildInspections(DateTime anchor)
    {
        var inspections = new List<Inspection>();
        var observations = new List<InspectionObservation>();
        var actions = new List<CorrectiveAction>();

        foreach (var (zoneId, zoneName, _) in Zones)
            for (var round = 0; round < 2; round++)
                inspections.Add(Tag(new Inspection
                {
                    Id = StableGuid($"insp:{zoneId}:{round}"),
                    Title = $"Weekly walk-down — {zoneName}",
                    ZoneId = zoneId,
                    InspectorName = "Inspector (demo)",
                    PerformedUtc = RoundTime(anchor, round, zoneId),
                }));

        for (var i = 0; i < Observations.Length; i++)
        {
            var o = Observations[i];
            var created = RoundTime(anchor, o.Round, o.Zone).AddMinutes(10 + i * 3);
            var closedOrResolved = o.Status is S.Resolved or S.Closed;
            var obs = Tag(new InspectionObservation
            {
                Id = StableGuid($"obs:{i}"),
                InspectionId = StableGuid($"insp:{o.Zone}:{o.Round}"),
                ZoneId = o.Zone, MachineId = o.Machine, Category = o.Cat, Priority = o.Pri, Status = o.Status,
                Description = o.Text,
                AssignedRole = o.Cat == C.Equipment ? Roles.MaintenanceEngineer : Roles.Inspector,
                CreatedUtc = created,
                UpdatedUtc = closedOrResolved || o.Status == S.InProgress ? created.AddHours(20) : created,
            });
            observations.Add(obs);

            for (var a = 0; a < o.Actions.Length; a++)
            {
                var done = closedOrResolved || (o.Status == S.InProgress && a == 0 && o.Actions.Length > 1);
                actions.Add(Tag(new CorrectiveAction
                {
                    Id = StableGuid($"ca:{i}:{a}"),
                    ObservationId = obs.Id,
                    Description = o.Actions[a],
                    Status = done ? CorrectiveActionStatus.Done
                        : o.Status == S.InProgress ? CorrectiveActionStatus.InProgress : CorrectiveActionStatus.Planned,
                    AssignedRole = obs.AssignedRole,
                    CreatedUtc = created.AddMinutes(30 + a),
                    DueUtc = created.AddDays(o.Pri >= P.High ? 2 : 7),
                    CompletedUtc = done ? created.AddHours(18 + a) : null,
                }));
            }
        }

        return (inspections, observations, actions);
    }

    public static List<MaintenanceRecord> BuildMaintenance(DateTime anchor)
    {
        var list = new List<MaintenanceRecord>();
        void Add(string machine, MaintenanceType type, double daysAgo, double hours, string text, string outcome) =>
            list.Add(Tag(new MaintenanceRecord
            {
                Id = StableGuid($"mr:{machine}:{list.Count}"),
                MachineId = machine, Type = type, Description = text, Outcome = outcome,
                PerformedBy = type == MaintenanceType.Inspection ? "Technician (demo)" : "Maintenance team (demo)",
                PerformedUtc = anchor.AddDays(-daysAgo), DurationHours = hours,
            }));

        for (var i = 0; i < Machines.Length; i++)
        {
            var m = Machines[i].Id;
            Add(m, MaintenanceType.Preventive, 30 + i * 2, 3, "Scheduled preventive service (lubrication, fastener check, filter change)", "Completed, no defects found");
            Add(m, MaintenanceType.Inspection, 10 + i % 5, 0.5, "Condition-monitoring route check", "Within limits");
        }

        Add("MACHINE-HP-002", MaintenanceType.Corrective, 62, 6, "Main cylinder seal kit replaced after oil leak", "Leak stopped; pressure test passed");
        Add("MACHINE-HP-002", MaintenanceType.Inspection, 3, 0.5, "Vibration route check — slight increase noted vs. baseline", "Within limits; recheck recommended");
        Add("MACHINE-PUMP-002", MaintenanceType.Corrective, 20, 2, "Flow transmitter recalibrated", "Calibrated against reference meter");
        Add("MACHINE-CONV-003", MaintenanceType.Corrective, 0.125, 0, "Drive gearbox removed for overhaul — conveyor isolated", "In progress");
        return list;
    }

    public static List<ProductionBatch> BuildBatches(DateTime anchor, Random rng)
    {
        var list = new List<ProductionBatch>();
        var start = anchor.Date.AddDays(-7);
        string[] lines = ["Floor tile 600×600 matte (demo)", "Wall tile 300×600 gloss (demo)", "Floor tile 450×450 anti-slip (demo)"];

        for (var shift = 0; start.AddHours(8 * (shift + 1)) <= anchor; shift++)
        {
            var started = start.AddHours(8 * shift);
            var press = Machines[shift % 4].Id;
            var units = 4000 + rng.Next(0, 1000);
            var rate = 0.015 + rng.NextDouble() * 0.015;
            if (press == SignalModel.DriftMachine && started > anchor - SignalModel.DriftWindow) rate += 0.03;
            list.Add(Tag(new ProductionBatch
            {
                Id = StableGuid($"batch:{shift}"),
                BatchCode = $"B-{started:yyyyMMdd}-{shift % 3 + 1}",
                ProductLine = lines[shift % lines.Length],
                PressMachineId = press,
                StartedUtc = started,
                CompletedUtc = started.AddHours(8),
                UnitsProduced = units,
                UnitsRejected = (int)Math.Round(units * rate),
            }));
        }
        return list;
    }

    static DateTime RoundTime(DateTime anchor, int round, string zoneId) =>
        anchor.Date.AddDays(round == 0 ? -6 : -2).AddHours(8 + Array.FindIndex(Zones, z => z.Id == zoneId));

    public static T Tag<T>(T e) where T : BusinessEntity
    {
        e.DataOrigin = DataOrigin.Synthetic;
        e.SeedBatchId = SeedBatchId;
        return e;
    }
}
