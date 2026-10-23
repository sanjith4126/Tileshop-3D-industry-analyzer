using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Infrastructure.Simulation;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

[Collection(ApiCollection.Name)]
public class MonitoringTests(ApiFactory factory)
{
    [Fact]
    public async Task Seeded_history_produces_HP002_alerts_at_crossing_times()
    {
        var alerts = await factory.CreateClient().GetFromJsonAsync<List<AlertDto>>("/api/alerts?machineId=MACHINE-HP-002&limit=50", Json);
        var vib = alerts!.Where(a => a.SensorId == "SENSOR-HP-002-VIB").ToList();

        var warn = Assert.Single(vib, a => a.Severity == AlertSeverity.Warning);
        var crit = Assert.Single(vib, a => a.Severity == AlertSeverity.Critical);
        Assert.True(warn.DetectedUtc < crit.DetectedUtc);
        Assert.Equal(4.5, warn.Threshold);
        Assert.True(crit.ObservedValue > 7.1);
        Assert.Contains(alerts!, a => a.SensorId == "SENSOR-HP-002-TEMP" && a.Severity == AlertSeverity.Warning);
        // No other machine crosses a limit in the seeded data.
        var all = await factory.CreateClient().GetFromJsonAsync<List<AlertDto>>("/api/alerts?limit=200", Json);
        Assert.All(all!, a => Assert.Equal("MACHINE-HP-002", a.MachineId));
    }

    [Fact]
    public async Task Acknowledge_and_resolve_enforce_roles_and_record_history()
    {
        var client = factory.CreateClient();
        var alert = (await client.GetFromJsonAsync<List<AlertDto>>("/api/alerts?machineId=MACHINE-HP-002&status=Open", Json))!
            .First(a => a.SensorId == "SENSOR-HP-002-TEMP");
        var ack = $"/api/alerts/{alert.Id}/acknowledge";
        var body = new AlertActionRequest("Checked on site");

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync(ack, body, Json)).StatusCode);
        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Viewer));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync(ack, body, Json)).StatusCode);

        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Inspector));
        var acked = await (await client.PostAsJsonAsync(ack, body, Json)).Content.ReadFromJsonAsync<AlertDto>(Json);
        Assert.Equal(AlertStatus.Acknowledged, acked!.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync(ack, body, Json)).StatusCode);   // already acknowledged
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/alerts/{alert.Id}/resolve", body, Json)).StatusCode);

        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.MaintenanceEngineer));
        var resolved = await (await client.PostAsJsonAsync($"/api/alerts/{alert.Id}/resolve", new AlertActionRequest(null), Json))
            .Content.ReadFromJsonAsync<AlertDto>(Json);
        Assert.Equal(AlertStatus.Resolved, resolved!.Status);
        Assert.Equal([AlertStatus.Acknowledged, AlertStatus.Resolved], resolved.History.Select(h => h.NewStatus));
        Assert.Equal("dev.inspector@tiletwin.local", resolved.History[0].UserName);
        Assert.Equal("Checked on site", resolved.History[0].Comment);
    }

    [Fact]
    public async Task Readings_are_downsampled_with_limits()
    {
        var client = factory.CreateClient();
        var r = await client.GetFromJsonAsync<ReadingsResponse>("/api/machines/MACHINE-HP-002/readings?range=24h", Json);

        Assert.Equal(300, r!.BucketSeconds);
        Assert.Equal(4, r.Sensors.Count);
        var vib = r.Sensors.Single(s => s.SensorId == "SENSOR-HP-002-VIB");
        Assert.Equal(7.1, vib.CriticalMax);
        Assert.InRange(vib.Points.Count, 250, 290);
        Assert.True(vib.Points[^1].Max > vib.Points[0].Max);   // drift upward over the day
        Assert.All(vib.Points, p => Assert.True(p.Min <= p.Avg && p.Avg <= p.Max));

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/machines/MACHINE-HP-002/readings?range=2y")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/machines/NOPE/readings?range=1h")).StatusCode);
    }

    [Fact]
    public async Task Simulator_tick_writes_live_readings_but_respects_offline_and_gap()
    {
        using var scope = factory.Services.CreateScope();
        var db = factory.CreateDbContext(scope);
        var engine = scope.ServiceProvider.GetRequiredService<SimulationEngine>();
        var now = DateTime.UtcNow;

        var written = await engine.TickAsync(now, backfill: false);

        var atNow = await db.SensorReadings.Where(r => r.TimestampUtc == now).ToListAsync();
        Assert.Equal(written, atNow.Count);
        Assert.Equal(49 - 2 - 1, written);   // 49 sensors − CONV-003 (2, offline) − PUMP-002 flow (gap)
        Assert.DoesNotContain(atNow, r => r.MachineId == "MACHINE-CONV-003");
        Assert.DoesNotContain(atNow, r => r.SensorId == "SENSOR-PUMP-002-FLOW");
        Assert.All(atNow, r => Assert.Equal(DataOrigin.Synthetic, r.DataOrigin));
        // HP-002 already has open alerts for its current severities, so no duplicates are opened.
        Assert.Equal(1, await db.Alerts.CountAsync(a => a.SensorId == "SENSOR-HP-002-VIB" && a.Severity == AlertSeverity.Critical));
    }
}
