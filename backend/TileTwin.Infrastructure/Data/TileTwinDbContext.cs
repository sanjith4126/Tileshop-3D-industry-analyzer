using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TileTwin.Domain.Entities;

namespace TileTwin.Infrastructure.Data;

public class AppUser : IdentityUser
{
    public string? DisplayName { get; set; }
}

/// <summary>Single-row table holding demo bookkeeping (which seed batch is loaded and its time anchor).</summary>
public class DemoState
{
    public int Id { get; set; } = 1;
    public required string SeedBatchId { get; set; }
    public DateTime AnchorUtc { get; set; }
    public DateTime SeededUtc { get; set; }
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
    public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();
    public DbSet<ProductionBatch> ProductionBatches => Set<ProductionBatch>();
    public DbSet<AuditLogEntry> AuditLog => Set<AuditLogEntry>();
    public DbSet<DemoState> DemoState => Set<DemoState>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

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

        // Restrict everywhere: deleting demo rows must never cascade into user-created rows.
        foreach (var fk in b.Model.GetEntityTypes().Where(t => t.ClrType.Namespace == typeof(Site).Namespace)
                     .SelectMany(t => t.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;
    }
}
