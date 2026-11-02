using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Security;

/// <summary>Requires any one of the named permissions (section 12.2). Endpoints use this, never role names.</summary>
public sealed class RequirePermissionAttribute : AuthorizeAttribute
{
    public const string Prefix = "perm:";

    public RequirePermissionAttribute(params string[] permissions)
    {
        Permissions = permissions;
        Policy = Prefix + string.Join('|', permissions);
    }

    public IReadOnlyList<string> Permissions { get; }
}

public sealed record PermissionRequirement(IReadOnlyList<string> AnyOf) : IAuthorizationRequirement;

/// <summary>Builds "perm:a|b" policies on demand: an authenticated user holding any of the permissions.</summary>
public sealed class PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : DefaultAuthorizationPolicyProvider(options)
{
    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName) =>
        policyName.StartsWith(RequirePermissionAttribute.Prefix, StringComparison.Ordinal)
            ? new AuthorizationPolicyBuilder().RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(policyName[RequirePermissionAttribute.Prefix.Length..].Split('|'))).Build()
            : await base.GetPolicyAsync(policyName);
}

public sealed class PermissionHandler(PermissionCatalog catalog) : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var granted = await catalog.ForAsync(context.User);
        if (requirement.AnyOf.Any(granted.Contains)) context.Succeed(requirement);
    }
}

/// <summary>
/// The role → permission mapping, read from the seeded RolePermissions table (cached for 5 minutes; it changes only
/// by migration). Role names come from the token's role claims.
/// </summary>
public sealed class PermissionCatalog(IServiceScopeFactory scopes, IMemoryCache cache)
{
    public async Task<IReadOnlySet<string>> ForAsync(ClaimsPrincipal user)
    {
        var map = await MapAsync();
        return user.FindAll("role").SelectMany(r => map.GetValueOrDefault(r.Value) ?? []).ToHashSet();
    }

    public async Task<IReadOnlySet<string>> ForRolesAsync(IEnumerable<string> roles)
    {
        var map = await MapAsync();
        return roles.SelectMany(r => map.GetValueOrDefault(r) ?? []).ToHashSet();
    }

    public async Task<IReadOnlyDictionary<string, string[]>> MapAsync() =>
        (await cache.GetOrCreateAsync("role-permissions", async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            using var scope = scopes.CreateScope();
            var rows = await scope.ServiceProvider.GetRequiredService<TileTwinDbContext>().RolePermissions.AsNoTracking().ToListAsync();
            return (IReadOnlyDictionary<string, string[]>)rows.GroupBy(r => r.RoleName)
                .ToDictionary(g => g.Key, g => g.Select(r => r.PermissionName).Order().ToArray());
        }))!;
}

/// <summary>The signed-in user of the current request and their permissions, for checks inside endpoints.</summary>
public sealed class CurrentUser(IHttpContextAccessor http, PermissionCatalog catalog)
{
    ClaimsPrincipal User => http.HttpContext?.User ?? new ClaimsPrincipal();

    public string? Name => User.Identity?.Name;

    public Task<IReadOnlySet<string>> PermissionsAsync() => catalog.ForAsync(User);

    public async Task<bool> CanAsync(string permission) => (await PermissionsAsync()).Contains(permission);
}
