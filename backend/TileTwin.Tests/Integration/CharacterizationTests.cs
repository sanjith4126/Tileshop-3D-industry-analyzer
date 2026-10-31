using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Infrastructure.Simulation;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

/// <summary>
/// Phase 3 characterization tests (docs/MASTER_PROMPT.md §23.3): they pin behaviour that works at the baseline so
/// later slices change it only deliberately (with a CHANGELOG entry and an updated test in the same commit).
/// Other flows are already pinned elsewhere: login (ApiTests), machine status (ApiTests), alert generation and
/// lifecycle (MonitoringTests), inspections and corrective actions (InspectionTests), reports (ReportTests).
/// </summary>
[Collection(ApiCollection.Name), Trait("Category", "Characterization")]
public class CharacterizationTests(ApiFactory factory)
{
    async Task<HttpClient> As(string role)
    {
        var c = factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(c, role));
        return c;
    }

    [Fact]
    public async Task Dashboard_figures_match_the_seeded_plant()
    {
        var o = await factory.CreateClient().GetFromJsonAsync<JsonElement>("/api/overview");

        var counts = o.GetProperty("statusCounts");
        Assert.Equal(13, counts.GetProperty("Normal").GetInt32());
        Assert.Equal(1, counts.GetProperty("Critical").GetInt32());
        Assert.Equal(1, counts.GetProperty("Unknown").GetInt32());
        Assert.Equal(1, counts.GetProperty("Offline").GetInt32());
        Assert.Equal(0, counts.GetProperty("Warning").GetInt32());
        Assert.True(o.GetProperty("openAlerts").GetProperty("total").GetInt32() >= 2); // other tests may resolve one
        Assert.True(o.GetProperty("openHighPriorityObservations").GetInt32() >= 1);
        // Production KPI over the last 7 days of seeded batches (fresh anchor = now in the test run).
        var production = o.GetProperty("production");
        Assert.True(production.GetProperty("units").GetInt32() > 0);
        Assert.InRange(production.GetProperty("ratePercent").GetDouble(), 0.1, 20);
    }

    [Fact]
    public async Task Simulator_pause_and_resume_stop_and_start_live_readings()
    {
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().PutAsJsonAsync("/api/admin/simulator", new SimulatorUpdateRequest(true), Json)).StatusCode);
        var engineer = await As(Roles.MaintenanceEngineer);
        Assert.Equal(HttpStatusCode.Forbidden, (await engineer.PutAsJsonAsync("/api/admin/simulator", new SimulatorUpdateRequest(true), Json)).StatusCode);

        var admin = await As(Roles.Admin);
        using var scope = factory.Services.CreateScope();
        var engine = scope.ServiceProvider.GetRequiredService<SimulationEngine>();
        try
        {
            Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync("/api/admin/simulator", new SimulatorUpdateRequest(true), Json)).StatusCode);
            Assert.True((await admin.GetFromJsonAsync<SimulatorStateDto>("/api/admin/simulator", Json))!.Paused);
            var paused = await engine.TickAsync(DateTime.UtcNow, SimulationEngine.Backfill.None);
            Assert.True(paused.Paused);
            Assert.Equal(0, paused.Written);
        }
        finally
        {
            Assert.Equal(HttpStatusCode.NoContent, (await admin.PutAsJsonAsync("/api/admin/simulator", new SimulatorUpdateRequest(false), Json)).StatusCode);
        }
        var resumed = await engine.TickAsync(DateTime.UtcNow, SimulationEngine.Backfill.None);
        Assert.False(resumed.Paused);
        Assert.True(resumed.Written > 0);

        var audit = await admin.GetStringAsync("/api/admin/audit?limit=50");
        Assert.Contains("simulator.pause", audit);
        Assert.Contains("simulator.resume", audit);
    }
}
