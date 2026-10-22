using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TileTwin.Api.Configuration;
using TileTwin.Api.Dtos;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

public class AuthService(UserManager<AppUser> users, AppConfig config, TimeProvider clock, AuditLogger audit, TileTwinDbContext db)
{
    public static readonly TimeSpan TokenLifetime = TimeSpan.FromHours(8);

    public static SymmetricSecurityKey SigningKey(AppConfig config) => new(Encoding.UTF8.GetBytes(config.JwtSigningKey));

    public async Task<LoginResponse?> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(req.Email);
        if (user is null || await users.IsLockedOutAsync(user)) return await Fail(req.Email, ct);

        if (!await users.CheckPasswordAsync(user, req.Password))
        {
            await users.AccessFailedAsync(user);
            return await Fail(req.Email, ct);
        }
        await users.ResetAccessFailedCountAsync(user);

        var roles = (await users.GetRolesAsync(user)).ToList();
        var expires = clock.GetUtcNow().UtcDateTime.Add(TokenLifetime);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new("name", user.Email!),
        };
        claims.AddRange(roles.Select(r => new Claim("role", r)));

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = AppConfig.JwtIssuer,
            Audience = AppConfig.JwtAudience,
            Expires = expires,
            SigningCredentials = new SigningCredentials(SigningKey(config), SecurityAlgorithms.HmacSha256),
        });

        audit.Add(user.Email, "auth.login", user.Id);
        await db.SaveChangesAsync(ct);
        return new LoginResponse(token, expires, user.Email!, user.DisplayName, roles);
    }

    async Task<LoginResponse?> Fail(string email, CancellationToken ct)
    {
        audit.Add(email, "auth.login-failed", null);
        await db.SaveChangesAsync(ct);
        return null;
    }
}
