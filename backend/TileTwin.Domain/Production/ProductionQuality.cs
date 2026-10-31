namespace TileTwin.Domain.Production;

/// <summary>Reject-rate KPI: rejected ÷ produced, in percent. No units produced means no rate (null), never 0 %.</summary>
public static class ProductionQuality
{
    public static double? RejectRatePercent(int produced, int rejected) =>
        produced > 0 ? Math.Round(100.0 * rejected / produced, 2) : null;
}
