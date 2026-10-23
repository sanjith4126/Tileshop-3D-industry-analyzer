namespace TileTwin.Domain.Maintenance;

public sealed record Trend(double SlopePerHour, double FittedStart, double FittedEnd, double ChangePercent, bool Notable, string Direction);

/// <summary>Least-squares trend over a window. "Notable" = fitted change of at least 10 % of the starting level.</summary>
public static class TrendAnalyzer
{
    public const double NotableChangePercent = 10;

    public static Trend? Analyze(IReadOnlyList<(DateTime T, double Value)> points)
    {
        if (points.Count < 3) return null;
        var t0 = points[0].T;
        var xs = points.Select(p => (p.T - t0).TotalHours).ToArray();
        var ys = points.Select(p => p.Value).ToArray();
        double mx = xs.Average(), my = ys.Average();
        double sxx = xs.Sum(x => (x - mx) * (x - mx));
        if (sxx == 0) return null;
        double slope = xs.Zip(ys).Sum(p => (p.First - mx) * (p.Second - my)) / sxx;

        double start = my + slope * (xs[0] - mx), end = my + slope * (xs[^1] - mx);
        double pct = start == 0 ? 0 : (end - start) / Math.Abs(start) * 100;
        bool notable = Math.Abs(pct) >= NotableChangePercent;
        return new Trend(slope, start, end, pct, notable, !notable ? "stable" : slope > 0 ? "rising" : "falling");
    }
}
