using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TileTwin.Api.Security;
using TileTwin.Domain;

namespace TileTwin.Tests.Integration;

/// <summary>
/// Authorisation tests generated from Appendix B of docs/MASTER_PROMPT.md (section 12.2): the table is parsed, compared
/// with the permission catalogue and the seeded mapping, and every endpoint of the live routing table is called
/// anonymously and as each role.
/// </summary>
[Collection(ApiCollection.Name)]
public partial class PermissionMatrixTests(ApiFactory factory)
{
    static readonly Dictionary<string, string> AppendixRoles = new()
    {
        ["Administrator"] = Roles.Administrator, ["Plant Manager"] = Roles.PlantManager,
        ["Maintenance Engineer"] = Roles.MaintenanceEngineer, ["Inspector"] = Roles.Inspector,
    };

    /// <summary>Capability → roles with any access ("All", "Assigned", "Own …"), straight from the markdown table.</summary>
    static Dictionary<string, HashSet<string>> AppendixB()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "docs", "MASTER_PROMPT.md"))) dir = dir.Parent;
        var text = File.ReadAllText(Path.Combine(dir!.FullName, "docs", "MASTER_PROMPT.md"));
        var section = text[text.IndexOf("## Appendix B", StringComparison.Ordinal)..];
        section = section[..section.IndexOf("\n## ", 5, StringComparison.Ordinal)];
        var rows = section.Split('\n').Where(l => l.StartsWith('|') && !l.StartsWith("|---")).Select(l => l.Trim('|', ' ', '\r').Split('|').Select(c => c.Trim()).ToArray()).ToList();
        var header = rows[0];
        return rows.Skip(1).ToDictionary(r => r[0], r => Enumerable.Range(1, header.Length - 1)
            .Where(i => r[i] is not ("–" or "-" or "")).Select(i => AppendixRoles[header[i]]).ToHashSet());
    }

    [Fact]
    public async Task Permission_catalogue_and_seeded_mapping_match_Appendix_B()
    {
        var appendix = AppendixB();
        Assert.Equal(19, appendix.Count);
        var core = Permissions.All.Where(d => !d.Extension).ToList();
        Assert.Equal(appendix.Keys.Order(), core.Select(d => d.Capability).Order());           // one permission per capability
        Assert.All(core, d => Assert.Equal(appendix[d.Capability].Order(), d.Roles.Order()));

        using var scope = factory.Services.CreateScope();
        var seeded = await factory.CreateDbContext(scope).RolePermissions.AsNoTracking().ToListAsync();
        Assert.Equal(Permissions.All.SelectMany(d => d.Roles.Select(r => $"{r}:{d.Name}")).Order(),
            seeded.Select(r => $"{r.RoleName}:{r.PermissionName}").Order());
    }

    sealed record Api(string Method, string Path, bool Public, IReadOnlyList<string>? AnyOf, bool Multipart);

    /// <summary>Every controller endpoint of the running API, with the permissions its policy requires.</summary>
    List<Api> Endpoints()
    {
        var data = factory.Services.GetRequiredService<EndpointDataSource>();
        return data.Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText!.TrimStart('/').StartsWith("api/", StringComparison.Ordinal))
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"]).Select(m =>
            {
                var policy = e.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy)
                    .FirstOrDefault(p => p?.StartsWith(RequirePermissionAttribute.Prefix, StringComparison.Ordinal) == true);
                var path = "/" + RouteParam().Replace(e.RoutePattern.RawText!.TrimStart('/'),
                    p => p.Value.Contains(":guid") ? Guid.Empty.ToString() : p.Value.Contains("type") ? "maintenance-prioritisation" : "MACHINE-HP-002");
                return new Api(m, path, e.Metadata.GetMetadata<IAllowAnonymous>() is not null,
                    policy?[RequirePermissionAttribute.Prefix.Length..].Split('|'),
                    e.Metadata.GetMetadata<IAcceptsMetadata>()?.ContentTypes.Contains("multipart/form-data") == true);
            })).ToList();
    }

    [GeneratedRegex(@"\{[^}]+\}")]
    private static partial Regex RouteParam();

    [Fact]
    public void Only_sign_in_and_health_are_public_and_every_other_endpoint_names_a_permission()
    {
        var endpoints = Endpoints();
        Assert.True(endpoints.Count > 40);
        Assert.Equal(["GET /api/health", "POST /api/auth/login", "POST /api/v1/auth/login", "POST /api/v1/auth/logout", "POST /api/v1/auth/refresh"],
            endpoints.Where(e => e.Public).Select(e => $"{e.Method} {e.Path}").Order());
        // Only "who am I" needs no particular permission.
        Assert.Equal(["GET /api/auth/me", "GET /api/v1/auth/me"],
            endpoints.Where(e => !e.Public && e.AnyOf is null).Select(e => $"{e.Method} {e.Path}").Order());
        // No role names in authorisation attributes (section 12.2: business code never checks role names).
        var roleChecks = typeof(RequirePermissionAttribute).Assembly.GetTypes()
            .SelectMany(t => t.GetMethods().Cast<System.Reflection.MemberInfo>().Prepend(t))
            .SelectMany(m => m.GetCustomAttributes(typeof(AuthorizeAttribute), false).Cast<AuthorizeAttribute>())
            .Where(a => a.Roles is not null);
        Assert.Empty(roleChecks);
    }

    [Fact]
    public async Task Every_endpoint_refuses_anonymous_callers_and_roles_without_its_permission()
    {
        var anonymous = factory.CreateClient();
        var clients = new Dictionary<string, HttpClient>();
        foreach (var role in Roles.All) clients[role] = await factory.SignedInClientAsync(role);
        var failures = new List<string>();

        foreach (var e in Endpoints().Where(e => !e.Public))
        {
            var anon = await Send(anonymous, e);
            if (anon != HttpStatusCode.Unauthorized) failures.Add($"anonymous {e.Method} {e.Path} → {(int)anon}");
            foreach (var role in Roles.All)
            {
                var allowed = e.AnyOf is null || e.AnyOf.Any(Permissions.Of([role]).Contains);
                if (allowed && e.Method != "GET") continue;                  // permitted writes have side effects; their tests live elsewhere
                var status = await Send(clients[role], e);
                if (!allowed && status != HttpStatusCode.Forbidden) failures.Add($"{role} {e.Method} {e.Path} → {(int)status}, expected 403");
                if (allowed && status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) failures.Add($"{role} GET {e.Path} → {(int)status}, expected access");
            }
        }
        Assert.Empty(failures);
    }

    static async Task<HttpStatusCode> Send(HttpClient client, Api e)
    {
        var req = new HttpRequestMessage(new HttpMethod(e.Method), e.Path);
        // A body of the declared type, so the request reaches authorisation (a wrong content type is refused earlier, with 415).
        if (e.Method is "POST" or "PUT" or "PATCH")
            req.Content = e.Multipart ? new MultipartFormDataContent { { new StringContent("x"), "noop" } } : new StringContent("{}", Encoding.UTF8, "application/json");
        return (await client.SendAsync(req)).StatusCode;
    }
}
