using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

/// <summary>
/// Per-request active-user check (section 12.1): a valid access token is refused once its user is deactivated or
/// deleted. Cached for at most 60 s; deactivation evicts the entry, so it takes effect at once on this instance.
/// </summary>
public sealed class ActiveUsers(IServiceScopeFactory scopes, IMemoryCache cache, TimeProvider clock)
{
    public static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(60);

    /// <summary>The user's email if the user exists and is active, otherwise null.</summary>
    public Task<string?> EmailIfActiveAsync(string userId, CancellationToken ct) =>
        cache.GetOrCreateAsync(Key(userId), async e =>
        {
            e.AbsoluteExpirationRelativeToNow = CacheFor;
            using var scope = scopes.CreateScope();
            var u = await scope.ServiceProvider.GetRequiredService<TileTwinDbContext>().Users.AsNoTracking()
                .Where(x => x.Id == userId).Select(x => new { x.Email, x.LockoutEnd }).FirstOrDefaultAsync(ct);
            return u is null || AuthService.IsDeactivated(u.LockoutEnd, clock.GetUtcNow().UtcDateTime) ? null : u.Email;
        });

    public void Forget(string userId) => cache.Remove(Key(userId));

    static string Key(string userId) => "active-user:" + userId;
}

/// <summary>
/// Login attempts per account (any email, existing or not), on top of the per-IP limit and the 5-failure lockout,
/// so guessing spread across many addresses is still capped. Off when RateLimiting:Disabled (integration tests).
/// </summary>
public sealed class LoginThrottle(IConfiguration configuration)
{
    public const int PermitLimit = 10;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(5);

    readonly bool disabled = configuration.GetValue("RateLimiting:Disabled", false);
    readonly PartitionedRateLimiter<string> limiter = PartitionedRateLimiter.Create<string, string>(email =>
        RateLimitPartition.GetFixedWindowLimiter(email, _ => new FixedWindowRateLimiterOptions { PermitLimit = PermitLimit, Window = Window }));

    public bool TryAcquire(string email)
    {
        if (disabled) return true;
        using var lease = limiter.AttemptAcquire(email.Trim().ToLowerInvariant());
        return lease.IsAcquired;
    }
}

/// <summary>Rejects common passwords (section 12.1). The length rule (12+) is Identity's own option.</summary>
public sealed class CommonPasswordValidator : IPasswordValidator<AppUser>
{
    // ponytail: a short static list of common long passwords; swap for a breached-password service if one is approved.
    static readonly HashSet<string> Common = new(StringComparer.OrdinalIgnoreCase)
    {
        "123456789012", "1234567890123", "12345678901234", "123456123456", "111111111111", "000000000000", "123123123123",
        "password1234", "password12345", "password123!", "password@123", "passw0rd1234", "p@ssw0rd1234", "p@ssword1234",
        "passwordpassword", "qwertyuiop12", "qwerty123456", "qwertyuiopasdf", "1q2w3e4r5t6y", "1qaz2wsx3edc", "asdfghjkl123",
        "iloveyou1234", "welcome12345", "welcome@1234", "letmein12345", "administrator", "admin1234567", "admin@123456",
        "changeme1234", "abcdefghijkl", "abc123abc123", "football1234", "baseball1234", "sunshine1234", "princess1234",
        "monkey123456", "dragon123456", "trustno1trustno1", "superman1234", "starwars1234", "tiletwin1234", "tiletwin2026",
    };

    public Task<IdentityResult> ValidateAsync(UserManager<AppUser> manager, AppUser user, string? password) =>
        Task.FromResult(password is not null && Common.Contains(password)
            ? IdentityResult.Failed(new IdentityError { Code = "CommonPassword", Description = "This password is too common. Choose another one." })
            : IdentityResult.Success);
}
