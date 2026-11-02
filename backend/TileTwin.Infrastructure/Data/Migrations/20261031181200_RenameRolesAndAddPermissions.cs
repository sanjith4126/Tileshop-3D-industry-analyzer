using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace TileTwin.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameRolesAndAddPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Decision D1: Viewer → PlantManager, Admin → Administrator. Rewrites existing rows, so back up the database
            // before applying it (README, "Upgrading an existing database"). Down() restores the old names.
            RenameRoles(migrationBuilder, ("Viewer", "PlantManager", "viewer", "plantmanager"), ("Admin", "Administrator", "admin", "administrator"));

            migrationBuilder.CreateTable(
                name: "Permissions",
                columns: table => new
                {
                    Name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Capability = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsExtension = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Permissions", x => x.Name);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    RoleName = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    PermissionName = table.Column<string>(type: "character varying(64)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => new { x.RoleName, x.PermissionName });
                    table.ForeignKey(
                        name: "FK_RolePermissions_Permissions_PermissionName",
                        column: x => x.PermissionName,
                        principalTable: "Permissions",
                        principalColumn: "Name",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Permissions",
                columns: new[] { "Name", "Capability", "IsExtension" },
                values: new object[,]
                {
                    { "alerts.acknowledge", "Acknowledge and resolve alerts", false },
                    { "alerts.view", "View alerts", false },
                    { "anomalies.view", "Anomaly scores and priority ranking", false },
                    { "assistant.use", "Use the AI assistant", false },
                    { "audit.view", "View the audit log", false },
                    { "corrective-actions.create", "Create corrective actions from findings", false },
                    { "corrective-actions.verify", "Verify corrective actions", false },
                    { "corrective-actions.work", "Start and complete corrective actions", false },
                    { "inspections.manage", "Create, assign and cancel inspections", false },
                    { "inspections.perform", "Perform inspections, record findings, upload evidence", false },
                    { "inspections.view", "View inspections and corrective actions", false },
                    { "knowledge.manage", "Upload, re-index and delete Knowledge Centre documents", true },
                    { "knowledge.view", "View and search Knowledge Centre documents", true },
                    { "machines.view", "Machine detail, readings and status history", false },
                    { "maintenance.manage", "Create and update maintenance records", false },
                    { "maintenance.view", "View maintenance records", false },
                    { "plant.manage", "Manage plants, zones, machines, sensors and thresholds", false },
                    { "plant.view", "Plant overview, dashboard and 3D twin at status level", false },
                    { "reports.generate", "Generate and download reports", false },
                    { "simulator.control", "Control the simulator", false },
                    { "tiles.inspect", "Submit tile images for quality inspection", true },
                    { "tiles.view", "View tile quality inspections", true },
                    { "users.manage", "Manage users, role assignments and data scope", false }
                });

            migrationBuilder.InsertData(
                table: "RolePermissions",
                columns: new[] { "PermissionName", "RoleName" },
                values: new object[,]
                {
                    { "alerts.acknowledge", "Administrator" },
                    { "alerts.view", "Administrator" },
                    { "anomalies.view", "Administrator" },
                    { "assistant.use", "Administrator" },
                    { "audit.view", "Administrator" },
                    { "corrective-actions.create", "Administrator" },
                    { "corrective-actions.verify", "Administrator" },
                    { "corrective-actions.work", "Administrator" },
                    { "inspections.manage", "Administrator" },
                    { "inspections.perform", "Administrator" },
                    { "inspections.view", "Administrator" },
                    { "knowledge.manage", "Administrator" },
                    { "knowledge.view", "Administrator" },
                    { "machines.view", "Administrator" },
                    { "maintenance.manage", "Administrator" },
                    { "maintenance.view", "Administrator" },
                    { "plant.manage", "Administrator" },
                    { "plant.view", "Administrator" },
                    { "reports.generate", "Administrator" },
                    { "simulator.control", "Administrator" },
                    { "tiles.inspect", "Administrator" },
                    { "tiles.view", "Administrator" },
                    { "users.manage", "Administrator" },
                    { "alerts.view", "Inspector" },
                    { "assistant.use", "Inspector" },
                    { "corrective-actions.create", "Inspector" },
                    { "corrective-actions.verify", "Inspector" },
                    { "inspections.perform", "Inspector" },
                    { "inspections.view", "Inspector" },
                    { "knowledge.view", "Inspector" },
                    { "machines.view", "Inspector" },
                    { "plant.view", "Inspector" },
                    { "reports.generate", "Inspector" },
                    { "tiles.inspect", "Inspector" },
                    { "tiles.view", "Inspector" },
                    { "alerts.acknowledge", "MaintenanceEngineer" },
                    { "alerts.view", "MaintenanceEngineer" },
                    { "anomalies.view", "MaintenanceEngineer" },
                    { "assistant.use", "MaintenanceEngineer" },
                    { "corrective-actions.work", "MaintenanceEngineer" },
                    { "inspections.view", "MaintenanceEngineer" },
                    { "knowledge.manage", "MaintenanceEngineer" },
                    { "knowledge.view", "MaintenanceEngineer" },
                    { "machines.view", "MaintenanceEngineer" },
                    { "maintenance.manage", "MaintenanceEngineer" },
                    { "maintenance.view", "MaintenanceEngineer" },
                    { "plant.view", "MaintenanceEngineer" },
                    { "reports.generate", "MaintenanceEngineer" },
                    { "tiles.inspect", "MaintenanceEngineer" },
                    { "tiles.view", "MaintenanceEngineer" },
                    { "alerts.acknowledge", "PlantManager" },
                    { "alerts.view", "PlantManager" },
                    { "anomalies.view", "PlantManager" },
                    { "assistant.use", "PlantManager" },
                    { "corrective-actions.create", "PlantManager" },
                    { "corrective-actions.verify", "PlantManager" },
                    { "inspections.manage", "PlantManager" },
                    { "inspections.view", "PlantManager" },
                    { "knowledge.manage", "PlantManager" },
                    { "knowledge.view", "PlantManager" },
                    { "machines.view", "PlantManager" },
                    { "maintenance.view", "PlantManager" },
                    { "plant.view", "PlantManager" },
                    { "reports.generate", "PlantManager" },
                    { "tiles.view", "PlantManager" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_PermissionName",
                table: "RolePermissions",
                column: "PermissionName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            RenameRoles(migrationBuilder, ("PlantManager", "Viewer", "plantmanager", "viewer"), ("Administrator", "Admin", "administrator", "admin"));

            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropTable(
                name: "Permissions");
        }

        /// <summary>Renames roles, the DEV ONLY users named after them (unless the new name is taken) and role
        /// assignments on observations and corrective actions. Audit and history rows keep the names they recorded.</summary>
        static void RenameRoles(MigrationBuilder mb, params (string From, string To, string DevFrom, string DevTo)[] renames)
        {
            foreach (var (from, to, devFrom, devTo) in renames)
            {
                mb.Sql($"""UPDATE "AspNetRoles" SET "Name" = '{to}', "NormalizedName" = '{to.ToUpperInvariant()}' WHERE "Name" = '{from}';""");
                var oldEmail = $"dev.{devFrom}@tiletwin.local";
                var newEmail = $"dev.{devTo}@tiletwin.local";
                mb.Sql($"""
                    UPDATE "AspNetUsers" SET "Email" = '{newEmail}', "NormalizedEmail" = '{newEmail.ToUpperInvariant()}',
                        "UserName" = '{newEmail}', "NormalizedUserName" = '{newEmail.ToUpperInvariant()}', "DisplayName" = 'DEV ONLY — {to}'
                    WHERE "NormalizedEmail" = '{oldEmail.ToUpperInvariant()}'
                      AND NOT EXISTS (SELECT 1 FROM "AspNetUsers" WHERE "NormalizedEmail" = '{newEmail.ToUpperInvariant()}');
                    """);
                foreach (var table in new[] { "InspectionObservations", "CorrectiveActions" })
                    mb.Sql($"""UPDATE "{table}" SET "AssignedRole" = '{to}' WHERE "AssignedRole" = '{from}';""");
                mb.Sql($"""UPDATE "InspectionObservations" SET "AssignedUser" = '{newEmail}' WHERE "AssignedUser" = '{oldEmail}';""");
            }
        }
    }
}
