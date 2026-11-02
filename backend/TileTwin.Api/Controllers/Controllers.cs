using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Configuration;
using TileTwin.Api.Dtos;
using TileTwin.Api.Security;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Controllers;

/// <summary>Anonymous liveness for probes and scripts: no plant data, configuration or internal addresses.</summary>
[ApiController, Route("api/health"), AllowAnonymous]
public class HealthController(TileTwinDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        bool dbOk;
        try { dbOk = await db.Database.CanConnectAsync(ct); }
        catch { dbOk = false; }
        return Ok(new
        {
            status = dbOk ? "ok" : "degraded",
            service = "TileTwin.Api",
            database = dbOk ? "ok" : "unavailable",
            timestampUtc = DateTime.UtcNow,
        });
    }
}

[ApiController, Route("api/zones"), RequirePermission(Permissions.PlantView)]
public class ZonesController(TileTwinDbContext db, MachineService machines) : ControllerBase
{
    [HttpGet]
    public async Task<List<ZoneDto>> List(CancellationToken ct)
    {
        var zones = await db.Zones.AsNoTracking().OrderBy(z => z.Id).ToListAsync(ct);
        var all = await machines.ListAsync(ct: ct);
        return zones.Select(z =>
        {
            var inZone = all.Where(m => m.ZoneId == z.Id).ToList();
            return new ZoneDto(z.Id, z.Name, z.Description, inZone.Count,
                inZone.GroupBy(m => m.Status).ToDictionary(g => g.Key, g => g.Count()), z.DataOrigin);
        }).ToList();
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        var zone = await db.Zones.AsNoTracking().FirstOrDefaultAsync(z => z.Id == id, ct);
        if (zone is null) return NotFound();
        var list = await machines.ListAsync(id, ct);
        return Ok(new { zone.Id, zone.Name, zone.Description, zone.DataOrigin, dataClassification = PlantData.Classification, machines = list });
    }
}

[ApiController, Route("api/machines")]
public class MachinesController(MachineService machines, ReadingsService readings, CurrentUser user) : ControllerBase
{
    [HttpGet, RequirePermission(Permissions.PlantView)]
    public async Task<List<MachineSummaryDto>> List([FromQuery] string? zoneId, [FromQuery] MachineStatus? status, CancellationToken ct)
    {
        var list = await machines.ListAsync(zoneId, ct);
        return status is null ? list : list.Where(m => m.Status == status).ToList();
    }

    /// <summary>Machine snapshot; recent maintenance only for roles that may view maintenance records.</summary>
    [HttpGet("{id}"), RequirePermission(Permissions.MachinesView)]
    public async Task<IActionResult> Get(string id, CancellationToken ct) =>
        await machines.GetAsync(id, await user.CanAsync(Permissions.MaintenanceView), ct) is { } m ? Ok(m) : NotFound();

    /// <summary>Downsampled time series per sensor. range = 1h | 24h | 7d.</summary>
    [HttpGet("{id}/readings"), RequirePermission(Permissions.MachinesView)]
    public async Task<IActionResult> Readings(string id, [FromQuery] string range = "24h", CancellationToken ct = default)
    {
        if (!ReadingsService.Ranges.ContainsKey(range))
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["range"] = ["Use 1h, 24h or 7d"] }));
        return await readings.GetAsync(id, range, ct) is { } r ? Ok(r) : NotFound();
    }

    [HttpPut("{id}/state"), RequirePermission(Permissions.MaintenanceManage)]
    public async Task<IActionResult> UpdateState(string id, UpdateMachineStateRequest req, CancellationToken ct) =>
        await machines.UpdateStateAsync(id, req, User.Identity?.Name, ct) ? NoContent() : NotFound();
}

/// <summary>
/// Sign-in, token refresh and sign-out. The refresh token travels only in an HttpOnly, Secure, SameSite=Strict cookie
/// scoped to /api/v1/auth; the access token is returned in the body and kept in memory by the SPA.
/// </summary>
[ApiController, Route("api/v1/auth")]
public class AuthController(AuthService auth, LoginThrottle throttle, CurrentUser currentUser) : ControllerBase
{
    public const string RefreshCookie = "tiletwin_refresh";
    const string CookiePath = "/api/v1/auth";
    static readonly long DeprecatedSince = new DateTimeOffset(2026, 10, 31, 0, 0, 0, TimeSpan.Zero).ToUnixTimeSeconds();

    [HttpPost("login"), HttpPost("/api/auth/login"), AllowAnonymous, EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginRequest req, CancellationToken ct)
    {
        if (Request.Path.StartsWithSegments("/api/auth")) Deprecated("/api/v1/auth/login");
        if (!throttle.TryAcquire(req.Email))
            return StatusCode(StatusCodes.Status429TooManyRequests, new { error = "Too many sign-in attempts for this account. Try again in a few minutes." });
        return await auth.LoginAsync(req, ct) is { } s ? Session(s) : Unauthorized(new { error = "Invalid email or password" });
    }

    /// <summary>204 when there is no refresh cookie at all (nobody signed in: not an error); 401 when the cookie is refused.</summary>
    [HttpPost("refresh"), AllowAnonymous, EnableRateLimiting("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        if (Request.Cookies[RefreshCookie] is not { Length: > 0 } raw) return NoContent();
        if (await auth.RefreshAsync(raw, ct) is { } s) return Session(s);
        Response.Cookies.Delete(RefreshCookie, CookieOptions(null));
        return Unauthorized(new { error = "Session ended — sign in again" });
    }

    [HttpPost("logout"), AllowAnonymous] // identified by the refresh cookie, so it works after the access token expired
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        if (Request.Cookies[RefreshCookie] is { Length: > 0 } raw) await auth.LogoutAsync(raw, ct);
        Response.Cookies.Delete(RefreshCookie, CookieOptions(null));
        return NoContent();
    }

    [HttpGet("me"), HttpGet("/api/auth/me"), Authorize] // any signed-in user
    public async Task<IActionResult> Me()
    {
        if (Request.Path.StartsWithSegments("/api/auth")) Deprecated("/api/v1/auth/me");
        return Ok(new
        {
            name = User.Identity?.Name, roles = User.FindAll("role").Select(c => c.Value).ToList(),
            permissions = (await currentUser.PermissionsAsync()).Order().ToList(),
        });
    }

    OkObjectResult Session(AuthSession s)
    {
        Response.Cookies.Append(RefreshCookie, s.RefreshToken, CookieOptions(s.RefreshExpiresUtc));
        return Ok(s.Response);
    }

    static CookieOptions CookieOptions(DateTime? expiresUtc) => new()
    {
        HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict, Path = CookiePath, IsEssential = true,
        Expires = expiresUtc is { } e ? new DateTimeOffset(e, TimeSpan.Zero) : null,
    };

    void Deprecated(string successor)
    {
        Response.Headers["Deprecation"] = $"@{DeprecatedSince}";
        Response.Headers.Link = $"<{successor}>; rel=\"successor-version\"";
    }
}
