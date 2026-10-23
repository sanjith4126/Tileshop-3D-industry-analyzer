using TileTwin.Infrastructure.Simulation;

namespace TileTwin.Api.Services;

/// <summary>Runs the synthetic data simulator every 5 s. Disable with Simulator__Enabled=false.</summary>
public class SimulatorHostedService(IServiceScopeFactory scopes, ILogger<SimulatorHostedService> log) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var backfill = true; // first successful tick after startup fills the downtime gap
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<SimulationEngine>().TickAsync(DateTime.UtcNow, backfill, ct);
                backfill = false;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                log.LogError(ex, "Simulator tick failed");
            }
        } while (await timer.WaitForNextTickAsync(ct));
    }
}
