using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Seeding;

namespace TileTwin.Tests.Integration;

[Collection(ApiCollection.Name)]
public class DemoSeederTests(ApiFactory factory)
{
    [Fact]
    public async Task Reset_preserves_user_created_rows_and_is_deterministic()
    {
        using var scope = factory.Services.CreateScope();
        var db = factory.CreateDbContext(scope);
        var seeder = scope.ServiceProvider.GetRequiredService<DemoSeeder>();

        await seeder.ResetAsync(DateTime.UtcNow); // known starting point (other tests add live readings)
        var observation = await db.InspectionObservations.OrderBy(o => o.Id).FirstAsync(o => o.DataOrigin == DataOrigin.Synthetic);
        var userAction = new CorrectiveAction
        {
            Id = Guid.NewGuid(), ObservationId = observation.Id, Description = "User-created action",
            CreatedUtc = DateTime.UtcNow, DataOrigin = DataOrigin.Real,
        };
        var userRecord = new MaintenanceRecord
        {
            Id = Guid.NewGuid(), MachineId = "MACHINE-HP-001", Description = "User-created record",
            PerformedUtc = DateTime.UtcNow, DataOrigin = DataOrigin.Real,
        };
        db.AddRange(userAction, userRecord);
        await db.SaveChangesAsync();

        var countsBefore = await CountsAsync(db);
        var pressureBefore = await FirstValuesAsync(db);

        try
        {
            await seeder.ResetAsync(DateTime.UtcNow);

            Assert.True(await db.CorrectiveActions.AnyAsync(a => a.Id == userAction.Id));
            Assert.True(await db.MaintenanceRecords.AnyAsync(r => r.Id == userRecord.Id));
            Assert.True(await db.InspectionObservations.AnyAsync(o => o.Id == observation.Id));
            Assert.Equal(countsBefore, await CountsAsync(db));
            Assert.Equal(pressureBefore, await FirstValuesAsync(db)); // same fixed seed => same values
        }
        finally
        {
            await db.CorrectiveActions.Where(a => a.Id == userAction.Id).ExecuteDeleteAsync();
            await db.MaintenanceRecords.Where(r => r.Id == userRecord.Id).ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task Seed_volumes_match_spec()
    {
        using var scope = factory.Services.CreateScope();
        var db = factory.CreateDbContext(scope);

        Assert.Equal(5, await db.Zones.CountAsync());
        Assert.Equal(16, await db.Machines.CountAsync());
        Assert.InRange(await db.InspectionObservations.CountAsync(o => o.DataOrigin == DataOrigin.Synthetic), 20, 30);
        Assert.True(await db.SensorReadings.CountAsync() > 400_000);
        Assert.True(await db.InspectionObservations.AnyAsync(o =>
            o.ZoneId == DemoPlant.ZoneGlaze && o.Status == ObservationStatus.Open && o.Priority >= ObservationPriority.High));
    }

    static async Task<int[]> CountsAsync(Infrastructure.Data.TileTwinDbContext db) =>
    [
        await db.SensorReadings.CountAsync(), await db.InspectionObservations.CountAsync(),
        await db.CorrectiveActions.CountAsync(), await db.MaintenanceRecords.CountAsync(),
        await db.ProductionBatches.CountAsync(),
    ];

    static Task<List<double>> FirstValuesAsync(Infrastructure.Data.TileTwinDbContext db) =>
        db.SensorReadings.Where(r => r.SensorId == "SENSOR-HP-001-PRES")
            .OrderBy(r => r.TimestampUtc).Take(20).Select(r => r.Value).ToListAsync();
}
