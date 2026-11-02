using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TileTwin.Api.Dtos;
using TileTwin.Api.Services;
using TileTwin.Domain;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

[Collection(ApiCollection.Name)]
public class AdminTests(ApiFactory factory)
{
    async Task<HttpClient> As(string role)
    {
        var c = factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(c, role));
        return c;
    }

    [Fact]
    public async Task Admin_endpoints_require_admin_role()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().GetAsync("/api/admin/users")).StatusCode);
        var engineer = await As(Roles.MaintenanceEngineer);
        Assert.Equal(HttpStatusCode.Forbidden, (await engineer.GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await engineer.PostAsync("/api/admin/reset-demo", null)).StatusCode);
    }

    [Fact]
    public async Task Admin_creates_user_who_can_sign_in_then_disables_them()
    {
        var admin = await As(Roles.Administrator);
        var email = $"new.{Guid.NewGuid():N}@tiletwin.local";
        const string pw = "Correct-Horse-Battery-9";

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/users", new CreateUserRequest(email, null, Roles.Inspector, "short"), Json)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/admin/users", new CreateUserRequest(email, null, "Boss", pw), Json)).StatusCode);
        var user = (await (await admin.PostAsJsonAsync("/api/admin/users", new CreateUserRequest(email, "New Inspector", Roles.Inspector, pw), Json))
            .Content.ReadFromJsonAsync<UserDto>(Json))!;
        Assert.Equal([Roles.Inspector], user.Roles);

        var login = new LoginRequest(email, pw);
        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().PostAsJsonAsync("/api/auth/login", login, Json)).StatusCode);

        var updated = (await (await admin.PutAsJsonAsync($"/api/admin/users/{user.Id}", new UpdateUserRequest(Roles.PlantManager, true), Json))
            .Content.ReadFromJsonAsync<UserDto>(Json))!;
        Assert.True(updated.Disabled);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync("/api/auth/login", login, Json)).StatusCode);

        var users = await admin.GetFromJsonAsync<List<UserDto>>("/api/admin/users", Json);
        var self = users!.Single(u => u.Email == "dev.administrator@tiletwin.local");
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/admin/users/{self.Id}", new UpdateUserRequest(Roles.Administrator, true), Json)).StatusCode);
    }

    [Fact]
    public async Task Overview_and_audit_and_reset()
    {
        var admin = await As(Roles.Administrator);
        var overview = await admin.GetFromJsonAsync<JsonElement>("/api/overview");
        Assert.Equal(1, overview.GetProperty("statusCounts").GetProperty("Critical").GetInt32());
        Assert.True(overview.GetProperty("openAlerts").GetProperty("critical").GetInt32() >= 1);
        Assert.True(overview.GetProperty("openHighPriorityObservations").GetInt32() >= 1);
        Assert.False(overview.GetProperty("config").GetProperty("ai").GetBoolean());
        Assert.False(overview.GetProperty("config").GetProperty("tileModel").GetProperty("configured").GetBoolean());

        var reset = await admin.PostAsync("/api/admin/reset-demo", null);
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        var machines = await admin.GetFromJsonAsync<List<MachineSummaryDto>>("/api/machines", Json);
        Assert.Equal(MachineStatus.Critical, machines!.Single(m => m.Id == "MACHINE-HP-002").Status);

        var audit = await admin.GetStringAsync("/api/admin/audit?limit=20");
        Assert.Contains("demo.reset", audit);
    }
}
