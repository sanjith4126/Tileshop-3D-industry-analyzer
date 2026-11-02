using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using TileTwin.Api.Dtos;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

/// <summary>Section 12.1: short-lived tokens without personal data, rotating refresh tokens, logout, deactivation, lockout.</summary>
[Collection(ApiCollection.Name)]
public class AuthTests(ApiFactory factory)
{
    const string Strong = "Auth-Test-Password-4821!";

    HttpClient Client() => factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    static string? RefreshCookie(HttpResponseMessage res) =>
        res.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.Where(v => v.StartsWith("tiletwin_refresh=", StringComparison.Ordinal))
                .Select(v => v.Split(';')[0]["tiletwin_refresh=".Length..]).FirstOrDefault(v => v.Length > 0)
            : null;

    async Task<HttpResponseMessage> Refresh(HttpClient client, string cookie)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req.Headers.Add("Cookie", $"tiletwin_refresh={cookie}");
        return await client.SendAsync(req);
    }

    async Task<(string Token, string Cookie)> SignIn(HttpClient client, string email, string password)
    {
        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, password), Json);
        res.EnsureSuccessStatusCode();
        return ((await res.Content.ReadFromJsonAsync<LoginResponse>(Json))!.Token, RefreshCookie(res)!);
    }

    async Task<string> CreateUser(string role)
    {
        var admin = Client();
        admin.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(admin, Roles.Administrator));
        var email = $"auth-test-{Guid.NewGuid():N}@tiletwin.local";
        (await admin.PostAsJsonAsync("/api/admin/users", new CreateUserRequest(email, "Auth test", role, Strong), Json)).EnsureSuccessStatusCode();
        return email;
    }

    async Task DeleteUser(string email)
    {
        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        if (await users.FindByEmailAsync(email) is { } u) await users.DeleteAsync(u);
    }

    [Fact]
    public async Task Login_gives_a_15_minute_token_without_personal_data_and_a_strict_refresh_cookie()
    {
        var res = await Client().PostAsJsonAsync("/api/v1/auth/login",
            new LoginRequest("dev.inspector@tiletwin.local", ApiFactory.TestPassword), Json);
        res.EnsureSuccessStatusCode();
        var jwt = new JsonWebToken((await res.Content.ReadFromJsonAsync<LoginResponse>(Json))!.Token);

        Assert.Equal(["aud", "exp", "iat", "iss", "jti", "role", "sub"], jwt.Claims.Select(c => c.Type).Distinct().Order());
        Assert.Equal("HS256", jwt.Alg);
        Assert.False(string.IsNullOrEmpty(jwt.Kid));
        Assert.Equal(TimeSpan.FromMinutes(15), jwt.ValidTo - jwt.IssuedAt);

        var cookie = res.Headers.GetValues("Set-Cookie").Single(v => v.StartsWith("tiletwin_refresh=")).ToLowerInvariant();
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=strict", cookie);
        Assert.Contains("path=/api/v1/auth", cookie);
    }

    [Fact]
    public async Task Old_login_route_still_works_and_is_marked_deprecated()
    {
        var res = await Client().PostAsJsonAsync("/api/auth/login", new LoginRequest("dev.plantmanager@tiletwin.local", ApiFactory.TestPassword), Json);
        res.EnsureSuccessStatusCode();
        Assert.True(res.Headers.Contains("Deprecation"));
        Assert.Contains("/api/v1/auth/login", res.Headers.GetValues("Link").Single());
    }

    [Fact]
    public async Task Refresh_rotates_and_reusing_an_old_token_ends_the_session()
    {
        var client = Client();
        var (_, first) = await SignIn(client, "dev.maintenanceengineer@tiletwin.local", ApiFactory.TestPassword);

        var rotated = await Refresh(client, first);
        Assert.Equal(HttpStatusCode.OK, rotated.StatusCode);
        var second = RefreshCookie(rotated)!;
        Assert.NotEqual(first, second);
        var me = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        me.Headers.Authorization = new("Bearer", (await rotated.Content.ReadFromJsonAsync<LoginResponse>(Json))!.Token);
        Assert.Contains("dev.maintenanceengineer@tiletwin.local", await (await client.SendAsync(me)).Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, first)).StatusCode);    // reuse of a rotated token
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, second)).StatusCode);   // ...revoked the whole family
        using var scope = factory.Services.CreateScope();
        Assert.True(await factory.CreateDbContext(scope).AuditLog.AnyAsync(a => a.Action == "auth.refresh-reuse"));
    }

    [Fact]
    public async Task Logout_revokes_the_session()
    {
        var client = Client();
        var (_, cookie) = await SignIn(client, "dev.plantmanager@tiletwin.local", ApiFactory.TestPassword);
        var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logout.Headers.Add("Cookie", $"tiletwin_refresh={cookie}");

        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(logout)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, cookie)).StatusCode);
        // Without any cookie there is simply no session: 204, so an anonymous page load logs no error.
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/v1/auth/refresh", null)).StatusCode);
    }

    [Fact]
    public async Task Deactivating_a_user_blocks_their_token_and_refresh_at_once()
    {
        var email = await CreateUser(Roles.Inspector);
        try
        {
            var client = Client();
            var (token, cookie) = await SignIn(client, email, Strong);
            client.DefaultRequestHeaders.Authorization = new("Bearer", token);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/auth/me")).StatusCode);

            var admin = Client();
            admin.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(admin, Roles.Administrator));
            var id = (await admin.GetFromJsonAsync<List<UserDto>>("/api/admin/users", Json))!.Single(u => u.Email == email).Id;
            (await admin.PutAsJsonAsync($"/api/admin/users/{id}", new UpdateUserRequest(Roles.Inspector, true), Json)).EnsureSuccessStatusCode();

            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/me")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(Client(), cookie)).StatusCode);
        }
        finally
        {
            await DeleteUser(email);
        }
    }

    [Fact]
    public async Task Five_failures_lock_the_account_for_15_minutes()
    {
        var email = await CreateUser(Roles.PlantManager);
        try
        {
            var client = Client();
            for (var i = 0; i < 5; i++)
                Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, "Wrong-Password-000!"), Json)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(email, Strong), Json)).StatusCode);

            using var scope = factory.Services.CreateScope();
            var end = (await scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>().FindByEmailAsync(email))!.LockoutEnd!.Value;
            Assert.InRange(end - DateTimeOffset.UtcNow, TimeSpan.FromMinutes(14), TimeSpan.FromMinutes(15));
        }
        finally
        {
            await DeleteUser(email);
        }
    }

    [Fact]
    public async Task Common_passwords_are_rejected()
    {
        var admin = Client();
        admin.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(admin, Roles.Administrator));
        var res = await admin.PostAsJsonAsync("/api/admin/users",
            new CreateUserRequest($"common-{Guid.NewGuid():N}@tiletwin.local", null, Roles.PlantManager, "Password1234"), Json);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("too common", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public void Login_attempts_are_limited_per_account()
    {
        var throttle = new LoginThrottle(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RateLimiting:Disabled"] = "false" }).Build());
        for (var i = 0; i < LoginThrottle.PermitLimit; i++) Assert.True(throttle.TryAcquire("someone@tiletwin.local"));
        Assert.False(throttle.TryAcquire(" SomeOne@TileTwin.local "));   // same account, any spelling
        Assert.True(throttle.TryAcquire("someone-else@tiletwin.local"));
    }
}
