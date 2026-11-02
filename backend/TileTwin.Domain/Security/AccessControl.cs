namespace TileTwin.Domain;

/// <summary>The four roles of master prompt section 12.2 (decision D1 renamed Viewer → PlantManager and Admin → Administrator).</summary>
public static class Roles
{
    public const string Administrator = "Administrator";
    public const string PlantManager = "PlantManager";
    public const string MaintenanceEngineer = "MaintenanceEngineer";
    public const string Inspector = "Inspector";

    public static readonly string[] All = [Administrator, PlantManager, MaintenanceEngineer, Inspector];
}

/// <summary>
/// Named permissions. Endpoints require these, never role names. Each Appendix B permission carries its capability
/// text exactly as Appendix B words it, so the authorisation tests can be generated from that table. The role →
/// permission mapping below is seeded by migration; changing it means adding a migration.
/// Data scope ("assigned", "own") is enforced separately by the access scope, not by these permissions.
/// </summary>
public static class Permissions
{
    public const string PlantView = "plant.view";
    public const string MachinesView = "machines.view";
    public const string PlantManage = "plant.manage";
    public const string AlertsView = "alerts.view";
    public const string AlertsAcknowledge = "alerts.acknowledge";
    public const string AnomaliesView = "anomalies.view";
    public const string MaintenanceView = "maintenance.view";
    public const string MaintenanceManage = "maintenance.manage";
    public const string InspectionsManage = "inspections.manage";
    public const string InspectionsPerform = "inspections.perform";
    public const string CorrectiveActionsCreate = "corrective-actions.create";
    public const string CorrectiveActionsWork = "corrective-actions.work";
    public const string CorrectiveActionsVerify = "corrective-actions.verify";
    public const string InspectionsView = "inspections.view";
    public const string ReportsGenerate = "reports.generate";
    public const string AssistantUse = "assistant.use";
    public const string UsersManage = "users.manage";
    public const string SimulatorControl = "simulator.control";
    public const string AuditView = "audit.view";
    // Extensions for the features kept by decision D2 (not in Appendix B).
    public const string KnowledgeView = "knowledge.view";
    public const string KnowledgeManage = "knowledge.manage";
    public const string TilesView = "tiles.view";
    public const string TilesInspect = "tiles.inspect";

    /// <param name="Capability">Appendix B wording, or a description for the D2 extensions.</param>
    public sealed record Definition(string Name, string Capability, bool Extension, params string[] Roles);

    const string A = Domain.Roles.Administrator, P = Domain.Roles.PlantManager, M = Domain.Roles.MaintenanceEngineer, I = Domain.Roles.Inspector;

    public static readonly IReadOnlyList<Definition> All =
    [
        new(PlantView, "Plant overview, dashboard and 3D twin at status level", false, A, P, M, I),
        new(MachinesView, "Machine detail, readings and status history", false, A, P, M, I),
        new(PlantManage, "Manage plants, zones, machines, sensors and thresholds", false, A),
        new(AlertsView, "View alerts", false, A, P, M, I),
        new(AlertsAcknowledge, "Acknowledge and resolve alerts", false, A, P, M),
        new(AnomaliesView, "Anomaly scores and priority ranking", false, A, P, M),
        new(MaintenanceView, "View maintenance records", false, A, P, M),
        new(MaintenanceManage, "Create and update maintenance records", false, A, M),
        new(InspectionsManage, "Create, assign and cancel inspections", false, A, P),
        new(InspectionsPerform, "Perform inspections, record findings, upload evidence", false, A, I),
        new(CorrectiveActionsCreate, "Create corrective actions from findings", false, A, P, I),
        new(CorrectiveActionsWork, "Start and complete corrective actions", false, A, M),
        new(CorrectiveActionsVerify, "Verify corrective actions", false, A, P, I),
        new(InspectionsView, "View inspections and corrective actions", false, A, P, M, I),
        new(ReportsGenerate, "Generate and download reports", false, A, P, M, I),
        new(AssistantUse, "Use the AI assistant", false, A, P, M, I),
        new(UsersManage, "Manage users, role assignments and data scope", false, A),
        new(SimulatorControl, "Control the simulator", false, A),
        new(AuditView, "View the audit log", false, A),
        new(KnowledgeView, "View and search Knowledge Centre documents", true, A, P, M, I),
        new(KnowledgeManage, "Upload, re-index and delete Knowledge Centre documents", true, A, P, M),
        new(TilesView, "View tile quality inspections", true, A, P, M, I),
        new(TilesInspect, "Submit tile images for quality inspection", true, A, M, I),
    ];

    /// <summary>The permissions of a set of roles, from this table (the seeded mapping).</summary>
    public static IReadOnlySet<string> Of(IEnumerable<string> roles)
    {
        var set = roles.ToHashSet();
        return All.Where(d => d.Roles.Any(set.Contains)).Select(d => d.Name).ToHashSet();
    }
}
