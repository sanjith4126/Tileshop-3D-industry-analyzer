using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TileTwin.Api.Configuration;
using TileTwin.Api.Services;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Seeding;

EnvFile.Load();
var builder = WebApplication.CreateBuilder(args);
var config = AppConfig.Load(builder.Configuration);

builder.Services.AddSingleton(config);
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<TileTwinDbContext>(o => o.UseNpgsql(config.ConnectionString));

builder.Services.AddIdentityCore<AppUser>(o =>
    {
        o.Password.RequiredLength = 12;
        o.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<TileTwinDbContext>()
    .AddDefaultTokenProviders();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = AppConfig.JwtIssuer,
        ValidAudience = AppConfig.JwtAudience,
        IssuerSigningKey = AuthService.SigningKey(config),
        NameClaimType = "name",
        RoleClaimType = "role",
    };
});
builder.Services.AddAuthorization();

builder.Services.AddScoped<AuditLogger>();
builder.Services.AddScoped<MachineService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<DemoSeeder>();
builder.Services.AddScoped<IdentitySeeder>();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();

var app = builder.Build();
config.LogFeatureStatus(app.Logger, app.Environment.IsDevelopment());
await InitializeDatabaseAsync(app, config);

app.MapOpenApi();
app.UseSwaggerUI(o =>
{
    o.SwaggerEndpoint("/openapi/v1.json", "TileTwin API");
    o.RoutePrefix = "swagger";
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

static async Task InitializeDatabaseAsync(WebApplication app, AppConfig config)
{
    using var scope = app.Services.CreateScope();
    var sp = scope.ServiceProvider;
    await sp.GetRequiredService<TileTwinDbContext>().Database.MigrateAsync();

    var identity = sp.GetRequiredService<IdentitySeeder>();
    await identity.SeedRolesAsync();
    if (config.Features(app.Environment.IsDevelopment()).DevUsers)
        await identity.SeedDevUsersAsync(config.DevSeedUserPassword!);

    await sp.GetRequiredService<DemoSeeder>().SeedIfEmptyAsync(DateTime.UtcNow);
}

public partial class Program;
