using TileTwin.Infrastructure.Simulation;

namespace TileTwin.Api.Services;

/// <summary>Runs the synthetic data simulator every 5 s. Disable with Simulator__Enabled=false.</summary>
public class SimulatorHostedService(IServiceScopeFactory scopes, ILogger<SimulatorHostedService> log) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Live ticks only: downtime (restart, PC sleep, admin pause) stays a gap in the data.
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<SimulationEngine>().TickAsync(DateTime.UtcNow, ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                log.LogError(ex, "Simulator tick failed");
            }
        } while (await timer.WaitForNextTickAsync(ct));
    }
}
