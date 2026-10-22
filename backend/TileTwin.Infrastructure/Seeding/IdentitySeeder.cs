using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Infrastructure.Seeding;

public class IdentitySeeder(RoleManager<IdentityRole> roles, UserManager<AppUser> users, ILogger<IdentitySeeder> log)
{
    public async Task SeedRolesAsync()
    {
        foreach (var role in Roles.All)
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole(role));
    }

    /// <summary>DEV ONLY: one user per role. Caller must only invoke this in Development with a password configured.</summary>
    public async Task SeedDevUsersAsync(string password)
    {
        foreach (var role in Roles.All)
        {
            var email = $"dev.{role.ToLowerInvariant()}@tiletwin.local";
            var user = await users.FindByEmailAsync(email);
            if (user is null)
            {
                user = new AppUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = $"DEV ONLY — {role}" };
                var created = await users.CreateAsync(user, password);
                if (!created.Succeeded)
                {
                    log.LogWarning("Could not create dev user {Email}: {Errors}", email,
                        string.Join("; ", created.Errors.Select(e => e.Description)));
                    continue;
                }
            }
            else
            {
                // Keep dev users in sync with the configured password.
                var token = await users.GeneratePasswordResetTokenAsync(user);
                await users.ResetPasswordAsync(user, token, password);
            }

            if (!await users.IsInRoleAsync(user, role))
                await users.AddToRoleAsync(user, role);
        }
        log.LogWarning("DEV ONLY users present (dev.<role>@tiletwin.local). Never enable outside Development.");
    }
}
