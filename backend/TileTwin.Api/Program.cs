using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TileTwin.Api.Configuration;
using TileTwin.Api.Services;
using TileTwin.Infrastructure.Data;
using TileTwin.Infrastructure.Seeding;
using TileTwin.Infrastructure.Simulation;

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
builder.Services.AddScoped<AlertService>();
builder.Services.AddScoped<InspectionService>();
builder.Services.AddScoped<PredictiveService>();
builder.Services.AddScoped<TileTwin.Api.Reports.ReportBuilder>();
builder.Services.AddScoped<TileTwin.Api.Reports.ReportService>();
builder.Services.AddScoped<AnomalyScoringService>();
builder.Services.AddSingleton<MlStatus>();
builder.Services.AddHttpClient<MlClient>(c =>
{
    c.BaseAddress = new Uri(config.MlServiceUrl);
    c.Timeout = TimeSpan.FromSeconds(10);
});
if (builder.Configuration.GetValue("Ml:ScheduledScoring", true))
    builder.Services.AddHostedService<AnomalyHostedService>();
builder.Services.AddScoped<ReadingsService>();
builder.Services.AddScoped<SimulationEngine>();
if (builder.Configuration.GetValue("Simulator:Enabled", true))
    builder.Services.AddHostedService<SimulatorHostedService>();

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

// 3D asset manifest + optional GLB files from the repo's 3d-assets folder.
if (EnvFile.FindUpward("3d-assets", directory: true) is { } assetsDir)
{
    var types = new FileExtensionContentTypeProvider();
    types.Mappings[".glb"] = "model/gltf-binary";
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(assetsDir),
        RequestPath = "/assets3d",
        ContentTypeProvider = types,
    });
}

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
