using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TileTwin.Api.Configuration;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Seeding;

namespace TileTwin.Tests.Integration;

/// <summary>
/// Runs the real API against a real PostgreSQL database named "&lt;dev db&gt;_test" (created by migrations).
/// Requires the docker compose Postgres to be running.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string TestPassword = "Test-Only-Password-123!";

    static ApiFactory()
    {
        Environment.SetEnvironmentVariable("DEV_SEED_USER_PASSWORD", TestPassword);
        Environment.SetEnvironmentVariable("Simulator__Enabled", "false"); // tests drive SimulationEngine directly
        Environment.SetEnvironmentVariable("Ml__ScheduledScoring", "false");
        Environment.SetEnvironmentVariable("RateLimiting__Disabled", "true"); // many logins per test run; RateLimitTests re-enables
        Environment.SetEnvironmentVariable("ANTHROPIC_API_KEY", " "); // never call a real LLM from tests (whitespace = not configured)
        Environment.SetEnvironmentVariable("GROQ_API_KEY", " ");
        Environment.SetEnvironmentVariable("ML_SERVICE_URL", "http://127.0.0.1:9"); // nothing listens: tests the "unavailable" path
        EnvFile.Load();
        var conn = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION")
                   ?? throw new InvalidOperationException("POSTGRES_CONNECTION not set (copy .env.example to .env)");
        var csb = new NpgsqlConnectionStringBuilder(conn);
        csb.Database = (csb.Database ?? "tiletwin") + "_test";
        Environment.SetEnvironmentVariable("POSTGRES_CONNECTION", csb.ConnectionString);
    }

    public async Task InitializeAsync()
    {
        // Fresh anchor = now, so time-dependent statuses are deterministic for the test run.
        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<DemoSeeder>().ResetAsync(DateTime.UtcNow);
    }

    public TileTwinDbContext CreateDbContext(IServiceScope scope) => scope.ServiceProvider.GetRequiredService<TileTwinDbContext>();

    readonly Dictionary<string, string> tokens = [];

    /// <summary>A client signed in as the DEV ONLY user of a role (one sign-in per role per test run; tokens last 15 min).</summary>
    public async Task<HttpClient> SignedInClientAsync(string role = Roles.Administrator)
    {
        var client = CreateClient();
        if (!tokens.TryGetValue(role, out var token)) tokens[role] = token = await ApiTests.LoginAsync(client, role);
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return client;
    }

    Task IAsyncLifetime.DisposeAsync() => Task.CompletedTask;
}

[CollectionDefinition(Name)]
public class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
