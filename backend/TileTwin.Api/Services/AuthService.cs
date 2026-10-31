using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TileTwin.Api.Configuration;
using TileTwin.Api.Dtos;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

/// <summary>A signed-in session: the access token for the response body and the refresh token for the cookie.</summary>
public sealed record AuthSession(LoginResponse Response, string RefreshToken, DateTime RefreshExpiresUtc);

/// <summary>
/// Sign-in, refresh-token rotation and sign-out (master prompt section 12.1). Access tokens are 15-minute JWTs that
/// carry only sub, roles, jti, iat, exp, iss and aud. Refresh tokens are 256-bit random values stored as SHA-256
/// hashes, rotated on every use, and all tokens of one sign-in (a family) expire 12 h after that sign-in.
/// </summary>
public class AuthService(UserManager<AppUser> users, AppConfig config, TimeProvider clock, AuditLogger audit, TileTwinDbContext db)
{
    public static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan RefreshLifetime = TimeSpan.FromHours(12);

    /// <summary>HMAC-SHA256 key; its id (in the JWT `kid` header) is derived from the key, so rotating the key changes it.</summary>
    public static SymmetricSecurityKey SigningKey(AppConfig config)
    {
        var bytes = Encoding.UTF8.GetBytes(config.JwtSigningKey);
        return new(bytes) { KeyId = Convert.ToHexStringLower(SHA256.HashData(bytes))[..16] };
    }

    /// <summary>Deactivated by an administrator (a lockout that never ends), as opposed to a 15-minute failed-login lockout.</summary>
    public static bool IsDeactivated(DateTimeOffset? lockoutEnd, DateTime nowUtc) => lockoutEnd is { } end && end.UtcDateTime > nowUtc.AddYears(10);

    public async Task<AuthSession?> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(req.Email);
        if (user is null || await users.IsLockedOutAsync(user)) return await Fail(req.Email, ct);

        if (!await users.CheckPasswordAsync(user, req.Password))
        {
            await users.AccessFailedAsync(user);
            return await Fail(req.Email, ct);
        }
        await users.ResetAccessFailedCountAsync(user);
        audit.Add(user.Email, "auth.login", user.Id);
        var now = clock.GetUtcNow().UtcDateTime;
        await db.RefreshTokens.Where(t => t.UserId == user.Id && t.ExpiresUtc < now).ExecuteDeleteAsync(ct);
        return await IssueAsync(user, Guid.NewGuid(), now + RefreshLifetime, ct);
    }

    /// <summary>Exchanges a refresh token for a new access token and a new refresh token in the same family.</summary>
    public async Task<AuthSession?> RefreshAsync(string rawToken, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var hash = Hash(rawToken);
        var token = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null || token.ExpiresUtc <= now) return null;

        // Mark it used atomically: if another request already used it (or it was revoked), this is a reuse.
        var claimed = await db.RefreshTokens.Where(t => t.Id == token.Id && t.UsedUtc == null && t.RevokedUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedUtc, now), ct);
        if (claimed == 0)
        {
            // A rotated or revoked token came back: assume it was stolen and end the whole session.
            await RevokeAsync(db.RefreshTokens.Where(t => t.FamilyId == token.FamilyId), "reuse detected", ct);
            audit.Add(null, "auth.refresh-reuse", token.UserId, new { token.FamilyId });
            await db.SaveChangesAsync(ct);
            return null;
        }

        var user = await users.FindByIdAsync(token.UserId);
        if (user is null || IsDeactivated(user.LockoutEnd, now))
        {
            await RevokeAsync(db.RefreshTokens.Where(t => t.FamilyId == token.FamilyId), "user inactive", ct);
            return null;
        }
        return await IssueAsync(user, token.FamilyId, token.ExpiresUtc, ct);
    }

    /// <summary>Signs out: revokes every token of the presented token's family.</summary>
    public async Task LogoutAsync(string rawToken, CancellationToken ct)
    {
        var hash = Hash(rawToken);
        var token = await db.RefreshTokens.AsNoTracking().FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null) return;
        await RevokeAsync(db.RefreshTokens.Where(t => t.FamilyId == token.FamilyId), "logout", ct);
        audit.Add(null, "auth.logout", token.UserId);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Revokes every refresh token of a user (deactivation).</summary>
    public Task RevokeAllAsync(string userId, string reason, CancellationToken ct) =>
        RevokeAsync(db.RefreshTokens.Where(t => t.UserId == userId), reason, ct);

    Task RevokeAsync(IQueryable<RefreshToken> tokens, string reason, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        return tokens.Where(t => t.RevokedUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedUtc, now).SetProperty(t => t.RevokedReason, reason), ct);
    }

    async Task<AuthSession> IssueAsync(AppUser user, Guid family, DateTime familyExpiresUtc, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var raw = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(), UserId = user.Id, FamilyId = family, TokenHash = Hash(raw), CreatedUtc = now, ExpiresUtc = familyExpiresUtc,
        });
        var roles = (await users.GetRolesAsync(user)).ToList();
        var expires = now + AccessTokenLifetime;
        await db.SaveChangesAsync(ct);
        return new AuthSession(new LoginResponse(AccessToken(user.Id, roles, now, expires), expires, user.Email!, user.DisplayName, roles),
            raw, familyExpiresUtc);
    }

    string AccessToken(string userId, IEnumerable<string> roles, DateTime now, DateTime expires)
    {
        var claims = new List<Claim> { new(JwtRegisteredClaimNames.Sub, userId), new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")) };
        claims.AddRange(roles.Select(r => new Claim("role", r)));
        // Times are set explicitly so the token carries iat and exp only (no nbf).
        return new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = AppConfig.JwtIssuer,
            Audience = AppConfig.JwtAudience,
            IssuedAt = now,
            Expires = expires,
            SigningCredentials = new SigningCredentials(SigningKey(config), SecurityAlgorithms.HmacSha256),
        });
    }

    static string Hash(string raw) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));

    async Task<AuthSession?> Fail(string email, CancellationToken ct)
    {
        audit.Add(email, "auth.login-failed", null);
        await db.SaveChangesAsync(ct);
        return null;
    }
}
