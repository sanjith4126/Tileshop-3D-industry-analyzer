var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapControllers();
app.MapGet("/api/health", () => new { status = "ok", service = "TileTwin.Api", timestampUtc = DateTime.UtcNow });

app.Run();

public partial class Program;
