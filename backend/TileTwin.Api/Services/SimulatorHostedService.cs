using TileTwin.Infrastructure.Simulation;

namespace TileTwin.Api.Services;

/// <summary>Runs the synthetic data simulator every 5 s. Disable with Simulator__Enabled=false.</summary>
public class SimulatorHostedService(IServiceScopeFactory scopes, ILogger<SimulatorHostedService> log) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // First tick: fill every missing minute (restart / PC sleep). Later ticks: fill any gap since the last
        // reading, except right after an admin pause (that gap is deliberate).
        var mode = SimulationEngine.Backfill.Holes;
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var r = await scope.ServiceProvider.GetRequiredService<SimulationEngine>().TickAsync(DateTime.UtcNow, mode, ct);
                mode = r.Paused ? SimulationEngine.Backfill.None : SimulationEngine.Backfill.SinceLast;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                log.LogError(ex, "Simulator tick failed");
            }
        } while (await timer.WaitForNextTickAsync(ct));
    }
}
