using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TileTwin.Api.Dtos;
using TileTwin.Domain;

namespace TileTwin.Tests.Integration;

[Collection(ApiCollection.Name)]
public class ApiTests(ApiFactory factory)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Health_reports_database_ok()
    {
        var body = await factory.CreateClient().GetStringAsync("/api/health");
        Assert.Contains("\"database\":\"ok\"", body);
        Assert.Contains("demo-v1", body);
    }

    [Fact]
    public async Task Seeded_machines_show_scripted_statuses()
    {
        var machines = await factory.CreateClient().GetFromJsonAsync<List<MachineSummaryDto>>("/api/machines", Json);

        Assert.Equal(16, machines!.Count);
        var byId = machines.ToDictionary(m => m.Id);
        Assert.Equal(MachineStatus.Critical, byId["MACHINE-HP-002"].Status);
        Assert.Equal(MachineStatus.Unknown, byId["MACHINE-PUMP-002"].Status);
        Assert.Equal(MachineStatus.Offline, byId["MACHINE-CONV-003"].Status);
        Assert.All(machines.Where(m => m.Id is not ("MACHINE-HP-002" or "MACHINE-PUMP-002" or "MACHINE-CONV-003")),
            m => Assert.Equal(MachineStatus.Normal, m.Status));
        Assert.All(machines, m => Assert.Equal(DataOrigin.Synthetic, m.DataOrigin));
    }

    [Fact]
    public async Task Machine_detail_includes_sensors_limits_and_maintenance()
    {
        var d = await factory.CreateClient().GetFromJsonAsync<MachineDetailDto>("/api/machines/MACHINE-HP-002", Json);

        Assert.Equal("Unknown (demo)", d!.Machine.Manufacturer);
        var vib = Assert.Single(d.Sensors, s => s.Id == "SENSOR-HP-002-VIB");
        Assert.Equal("Critical", vib.State);
        Assert.Equal(7.1, vib.CriticalMax);
        Assert.NotEmpty(d.RecentMaintenance);
    }

    [Fact]
    public async Task Unknown_machine_returns_404() =>
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().GetAsync("/api/machines/NOPE")).StatusCode);

    [Fact]
    public async Task Zones_list_has_five_zones() =>
        Assert.Equal(5, (await factory.CreateClient().GetFromJsonAsync<List<ZoneDto>>("/api/zones", Json))!.Count);

    [Fact]
    public async Task Write_endpoint_enforces_roles()
    {
        var client = factory.CreateClient();
        var body = new UpdateMachineStateRequest(MaintenanceStatus.InService, false);
        const string url = "/api/machines/MACHINE-HP-004/state";

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PutAsJsonAsync(url, body, Json)).StatusCode);

        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Viewer));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(url, body, Json)).StatusCode);

        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.MaintenanceEngineer));
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync(url, body, Json)).StatusCode);
    }

    [Fact]
    public async Task Login_with_wrong_password_is_rejected()
    {
        var res = await factory.CreateClient().PostAsJsonAsync("/api/auth/login",
            new LoginRequest("dev.inspector@tiletwin.local", "definitely-wrong-pass"));
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    public static async Task<string> LoginAsync(HttpClient client, string role)
    {
        var res = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest($"dev.{role.ToLowerInvariant()}@tiletwin.local", ApiFactory.TestPassword));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<LoginResponse>(Json))!.Token;
    }
}
