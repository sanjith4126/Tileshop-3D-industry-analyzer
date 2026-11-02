using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

public sealed record UserDto(string Id, string Email, string? DisplayName, IReadOnlyList<string> Roles, bool Disabled);

public sealed record CreateUserRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [MaxLength(100)] string? DisplayName,
    [Required] string Role,
    [Required, MinLength(12), MaxLength(128)] string Password);

public sealed record UpdateUserRequest([Required] string Role, bool Disabled);

/// <summary>Admin user management. There is no default admin password; admins create users explicitly.</summary>
public class UserAdminService(UserManager<AppUser> users, AuditLogger audit, TileTwinDbContext db, AuthService auth, ActiveUsers active)
{
    public async Task<List<UserDto>> ListAsync()
    {
        var list = await users.Users.OrderBy(u => u.Email).ToListAsync();
        var result = new List<UserDto>();
        foreach (var u in list) result.Add(await ToDto(u));
        return result;
    }

    public async Task<(UserDto? User, string? Error)> CreateAsync(CreateUserRequest req, string admin)
    {
        if (!Roles.All.Contains(req.Role)) return (null, $"Role must be one of {string.Join(", ", Roles.All)}");
        var user = new AppUser { UserName = req.Email, Email = req.Email, EmailConfirmed = true, DisplayName = req.DisplayName };
        var created = await users.CreateAsync(user, req.Password);
        if (!created.Succeeded) return (null, string.Join(" ", created.Errors.Select(e => e.Description)));
        await users.AddToRoleAsync(user, req.Role);
        audit.Add(admin, "user.create", user.Id, new { req.Email, req.Role });
        await db.SaveChangesAsync();
        return (await ToDto(user), null);
    }

    public async Task<(UserDto? User, string? Error)> UpdateAsync(string id, UpdateUserRequest req, string admin)
    {
        if (!Roles.All.Contains(req.Role)) return (null, $"Role must be one of {string.Join(", ", Roles.All)}");
        var user = await users.FindByIdAsync(id);
        if (user is null) return (null, null);
        if (user.Email == admin && (req.Disabled || req.Role != Roles.Administrator)) return (null, "You cannot disable or demote your own account");

        var current = await users.GetRolesAsync(user);
        await users.RemoveFromRolesAsync(user, current);
        await users.AddToRoleAsync(user, req.Role);
        await users.SetLockoutEnabledAsync(user, true);
        await users.SetLockoutEndDateAsync(user, req.Disabled ? DateTimeOffset.MaxValue : null);
        if (req.Disabled) await auth.RevokeAllAsync(user.Id, "user deactivated", CancellationToken.None);
        active.Forget(user.Id); // the next request re-checks: a deactivated user's access token stops working now
        audit.Add(admin, "user.update", id, new { req.Role, req.Disabled });
        await db.SaveChangesAsync();
        return (await ToDto(user), null);
    }

    async Task<UserDto> ToDto(AppUser u) => new(u.Id, u.Email ?? "", u.DisplayName, (await users.GetRolesAsync(u)).ToList(),
        AuthService.IsDeactivated(u.LockoutEnd, DateTime.UtcNow));
}
