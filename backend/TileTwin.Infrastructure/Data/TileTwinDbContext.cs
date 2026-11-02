using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TileTwin.Domain.Entities;

namespace TileTwin.Infrastructure.Data;

public class AppUser : IdentityUser
{
    public string? DisplayName { get; set; }
}

/// <summary>
/// A refresh token, stored only as a SHA-256 hash. Tokens rotate on every use; all tokens issued from one sign-in
/// share a FamilyId and its absolute expiry. Presenting a used or revoked token revokes the whole family.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public required string UserId { get; set; }
    public Guid FamilyId { get; set; }
    public required string TokenHash { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime ExpiresUtc { get; set; }
    public DateTime? UsedUtc { get; set; }
    public DateTime? RevokedUtc { get; set; }
    public string? RevokedReason { get; set; }
}

/// <summary>A named permission (master prompt section 12.2). Seeded from <see cref="TileTwin.Domain.Permissions"/>.</summary>
public class PermissionEntry
{
    public required string Name { get; set; }
    public required string Capability { get; set; }
    public bool IsExtension { get; set; }
}

/// <summary>Role → permission mapping, seeded by migration and read-only at run time.</summary>
public class RolePermission
{
    public required string RoleName { get; set; }
    public required string PermissionName { get; set; }
}

/// <summary>Single-row table holding demo bookkeeping (which seed batch is loaded and its time anchor).</summary>
public class DemoState
{
    public int Id { get; set; } = 1;
    public required string SeedBatchId { get; set; }
    public DateTime AnchorUtc { get; set; }
    public DateTime SeededUtc { get; set; }
    public bool SimulatorPaused { get; set; }
}

public class TileTwinDbContext(DbContextOptions<TileTwinDbContext> options) : IdentityDbContext<AppUser>(options)
{
    public DbSet<Site> Sites => Set<Site>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<MachineType> MachineTypes => Set<MachineType>();
    public DbSet<Machine> Machines => Set<Machine>();
    public DbSet<SensorDefinition> SensorDefinitions => Set<SensorDefinition>();
    public DbSet<SensorReading> SensorReadings => Set<SensorReading>();
    public DbSet<Inspection> Inspections => Set<Inspection>();
    public DbSet<InspectionObservation> InspectionObservations => Set<InspectionObservation>();
    public DbSet<CorrectiveAction> CorrectiveActions => Set<CorrectiveAction>();
    public DbSet<ObservationAttachment> ObservationAttachments => Set<ObservationAttachment>();
    public DbSet<ObservationEvent> ObservationEvents => Set<ObservationEvent>();
    public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();
    public DbSet<ProductionBatch> ProductionBatches => Set<ProductionBatch>();
    public DbSet<AuditLogEntry> AuditLog => Set<AuditLogEntry>();
    public DbSet<Alert> Alerts => Set<Alert>();
    public DbSet<AlertAcknowledgement> AlertAcknowledgements => Set<AlertAcknowledgement>();
    public DbSet<AnomalyScore> AnomalyScores => Set<AnomalyScore>();
    public DbSet<MlModel> MlModels => Set<MlModel>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<WorkflowExecution> WorkflowExecutions => Set<WorkflowExecution>();
    public DbSet<TileInspection> TileInspections => Set<TileInspection>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<DocumentChunk> DocumentChunks => Set<DocumentChunk>();
    public DbSet<DemoState> DemoState => Set<DemoState>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PermissionEntry> Permissions => Set<PermissionEntry>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<RefreshToken>(e =>
        {
            e.HasOne<AppUser>().WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            e.Property(t => t.TokenHash).HasMaxLength(64);
            e.Property(t => t.RevokedReason).HasMaxLength(64);
            e.HasIndex(t => t.TokenHash).IsUnique();
            e.HasIndex(t => t.FamilyId);
            e.HasIndex(t => t.UserId);
        });

        b.Entity<PermissionEntry>(e =>
        {
            e.ToTable("Permissions");
            e.HasKey(x => x.Name);
            e.Property(x => x.Name).HasMaxLength(64);
            e.Property(x => x.Capability).HasMaxLength(200);
            e.HasData(Domain.Permissions.All.Select(d => new PermissionEntry { Name = d.Name, Capability = d.Capability, IsExtension = d.Extension }));
        });
        b.Entity<RolePermission>(e =>
        {
            e.HasKey(x => new { x.RoleName, x.PermissionName });
            e.Property(x => x.RoleName).HasMaxLength(64);
            e.HasOne<PermissionEntry>().WithMany().HasForeignKey(x => x.PermissionName);
            e.HasData(Domain.Permissions.All.SelectMany(d => d.Roles.Select(r => new RolePermission { RoleName = r, PermissionName = d.Name })));
        });

        b.Entity<Zone>().HasOne<Site>().WithMany(s => s.Zones).HasForeignKey(z => z.SiteId);
        b.Entity<Machine>().HasOne(m => m.Zone).WithMany(z => z.Machines).HasForeignKey(m => m.ZoneId);
        b.Entity<Machine>().HasOne(m => m.MachineType).WithMany().HasForeignKey(m => m.MachineTypeId);
        b.Entity<SensorDefinition>().HasOne<Machine>().WithMany(m => m.Sensors).HasForeignKey(s => s.MachineId);

        b.Entity<SensorReading>(e =>
        {
            e.HasOne<Machine>().WithMany().HasForeignKey(r => r.MachineId);
            e.HasOne<SensorDefinition>().WithMany().HasForeignKey(r => r.SensorId);
            e.HasIndex(r => new { r.MachineId, r.SensorId, r.TimestampUtc });
        });

        b.Entity<Inspection>().HasOne<Zone>().WithMany().HasForeignKey(i => i.ZoneId);
        b.Entity<InspectionObservation>(e =>
        {
            e.HasOne<Inspection>().WithMany(i => i.Observations).HasForeignKey(o => o.InspectionId);
            e.HasOne(o => o.Zone).WithMany().HasForeignKey(o => o.ZoneId);
            e.HasOne<Machine>().WithMany().HasForeignKey(o => o.MachineId);
            e.HasIndex(o => new { o.ZoneId, o.Status, o.Priority });
        });
        b.Entity<CorrectiveAction>().HasOne<InspectionObservation>().WithMany(o => o.CorrectiveActions)
            .HasForeignKey(a => a.ObservationId);
        b.Entity<ObservationAttachment>().HasOne<InspectionObservation>().WithMany(o => o.Attachments)
            .HasForeignKey(a => a.ObservationId);
        b.Entity<ObservationEvent>().HasOne<InspectionObservation>().WithMany(o => o.Events)
            .HasForeignKey(e => e.ObservationId);
        b.Entity<MaintenanceRecord>(e =>
        {
            e.HasOne<Machine>().WithMany().HasForeignKey(m => m.MachineId);
            e.HasIndex(m => new { m.MachineId, m.PerformedUtc });
        });
        b.Entity<ProductionBatch>(e =>
        {
            e.HasOne<Machine>().WithMany().HasForeignKey(p => p.PressMachineId);
            e.HasIndex(p => p.BatchCode).IsUnique();
        });
        b.Entity<AuditLogEntry>().ToTable("AuditLog").HasIndex(a => a.TimestampUtc);
        b.Entity<Alert>(e =>
        {
            e.HasOne<Machine>().WithMany().HasForeignKey(a => a.MachineId);
            e.HasOne<SensorDefinition>().WithMany().HasForeignKey(a => a.SensorId);
            e.HasIndex(a => new { a.Status, a.MachineId });
        });
        b.Entity<Report>().HasIndex(r => r.GeneratedUtc);
        b.Entity<WorkflowExecution>().HasIndex(w => w.StartedUtc);
        b.Entity<TileInspection>().HasIndex(t => t.UploadedUtc);
        b.HasPostgresExtension("vector");
        b.Entity<DocumentChunk>(e =>
        {
            e.HasOne<Document>().WithMany().HasForeignKey(c => c.DocumentId);
            e.HasIndex(c => new { c.DocumentId, c.Index }).IsUnique();
            // Full-text search column maintained by PostgreSQL.
            e.Property<NpgsqlTypes.NpgsqlTsVector>("SearchVector")
                .HasComputedColumnSql("""to_tsvector('english', "Text")""", stored: true);
            e.HasIndex("SearchVector").HasMethod("GIN");
            // Optional semantic embedding (pgvector), unbounded dimension so any provider fits.
            e.Property<Pgvector.Vector?>("Embedding").HasColumnType("vector");
        });
        b.Entity<AnomalyScore>(e =>
        {
            e.HasOne<Machine>().WithMany().HasForeignKey(a => a.MachineId);
            e.HasIndex(a => new { a.MachineId, a.TimestampUtc });
        });
        b.Entity<AlertAcknowledgement>().HasOne<Alert>().WithMany(a => a.History).HasForeignKey(h => h.AlertId);

        // Restrict everywhere: deleting demo rows must never cascade into user-created rows.
        foreach (var fk in b.Model.GetEntityTypes().Where(t => t.ClrType.Namespace == typeof(Site).Namespace)
                     .SelectMany(t => t.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;
    }
}
