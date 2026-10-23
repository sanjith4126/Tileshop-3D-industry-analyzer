using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Domain.Maintenance;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Services;

/// <summary>Predictive-maintenance view: observed patterns, ML score, rule-based suggestions, data quality.</summary>
public class PredictiveService(TileTwinDbContext db, MachineService machines, ReadingsService readings, AlertService alerts,
    MlStatus ml, TimeProvider clock)
{
    public const string ReviewLabel = "Suggestion — requires review by a qualified engineer.";
    public const string FailurePrediction =
        "Not implemented: predicting failures needs labelled failure history from the real plant. The score shows how unusual recent data is, not when a failure will occur.";

    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static AnomalyScoreDto ToDto(AnomalyScore a, DateTime now) => new(
        a.Score, a.Threshold, a.MaxFeatureZ, a.ZThreshold, a.IsAnomaly, a.ModelVersion, a.TimestampUtc,
        a.TopDeviationsJson is null ? [] : JsonSerializer.Deserialize<List<MlDeviation>>(a.TopDeviationsJson, Json) ?? [],
        now - a.TimestampUtc <= AnomalyScoringService.Fresh);

    public async Task<List<PredictiveListItem>> ListAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var list = await machines.ListAsync(ct: ct);
        var since = now.AddHours(-24);
        var latest = (await db.AnomalyScores.AsNoTracking().Where(a => a.TimestampUtc > since).ToListAsync(ct))
            .GroupBy(a => a.MachineId).ToDictionary(g => g.Key, g => g.MaxBy(a => a.TimestampUtc)!);
        return list.Select(m => new PredictiveListItem(m.Id, m.Name, m.Status,
            latest.TryGetValue(m.Id, out var s) ? ToDto(s, now) : null)).ToList();
    }

    public async Task<PredictiveDto?> GetAsync(string machineId, CancellationToken ct)
    {
        var detail = await machines.GetAsync(machineId, ct);
        if (detail is null) return null;
        var now = clock.GetUtcNow().UtcDateTime;
        var m = detail.Machine;

        var since = now.AddHours(-24);
        var scores = await db.AnomalyScores.AsNoTracking().Where(a => a.MachineId == machineId && a.TimestampUtc > since)
            .OrderBy(a => a.TimestampUtc).ToListAsync(ct);
        var latest = scores.LastOrDefault() is { } l ? ToDto(l, now) : null;

        var series = (await readings.GetAsync(machineId, "24h", ct))!;
        var trends = series.Sensors.Select(s =>
        {
            var state = detail.Sensors.FirstOrDefault(d => d.Id == s.SensorId)?.State ?? "Missing";
            var perHour = 3600 / series.BucketSeconds;
            double? Avg(IEnumerable<SeriesPoint> pts) => pts.Any() ? Math.Round(pts.Average(p => p.Avg), 2) : null;
            return new SensorTrendDto(s.SensorId, s.Measurement, s.Unit, state, TrendAnalyzer.Analyze(s.Points.Select(p => (p.T, p.Avg)).ToList()),
                Avg(s.Points.Take(perHour)), Avg(s.Points.TakeLast(perHour)));
        }).ToList();

        var (patterns, signals) = Observe(trends, detail, latest);
        var quality = DataQuality(series, detail, latest, m);

        return new PredictiveDto(m, new MlStatusDto(ml.Available, ml.Message, ml.LastCheckedUtc), latest,
            scores.Select(s => ToDto(s, now)).ToList(), trends, patterns, SuggestionRules.For(signals), quality,
            await alerts.ListAsync(machineId, null, 20, ct), detail.RecentMaintenance, ReviewLabel, FailurePrediction);
    }

    static (List<string> Patterns, List<Signal> Signals) Observe(List<SensorTrendDto> trends, MachineDetailDto detail, AnomalyScoreDto? latest)
    {
        var patterns = new List<string>();
        var signals = new List<Signal>();
        // Most severe sensors first, so suggestions start with the critical one.
        foreach (var t in trends.OrderBy(t => t.State switch { "Critical" => 0, "Warning" => 1, "Missing" => 2, _ => 3 }))
        {
            var suffix = AnomalyScoringService.Suffix(t.SensorId);
            var sensor = detail.Sensors.First(s => s.Id == t.SensorId);
            if (t.State == "Missing")
            {
                patterns.Add($"{t.Measurement}: no recent data.");
                signals.Add(new(suffix, t.Measurement, SignalKind.Missing, "no recent reading"));
                continue;
            }
            if (t.State is "Warning" or "Critical" && sensor.LatestValue is { } v)
            {
                var high = (sensor.WarningMax is { } wMax && v > wMax) || (sensor.CriticalMax is { } cMax && v > cMax);
                signals.Add(new(suffix, t.Measurement, high ? SignalKind.High : SignalKind.Low, $"{v:0.##} {t.Unit} beyond {t.State.ToLowerInvariant()} limit"));
            }
            if (t.Trend is { Notable: true } tr)
            {
                patterns.Add($"{t.Measurement} {tr.Direction}: first-hour average {t.FirstHourAvg} → last-hour average {t.LastHourAvg} {t.Unit} over 24 h (linear trend {tr.SlopePerHour:+0.###;-0.###} {t.Unit}/h)"
                             + (t.State is "Warning" or "Critical" ? $"; now beyond its {t.State.ToLowerInvariant()} limit." : "."));
                signals.Add(new(suffix, t.Measurement, tr.SlopePerHour > 0 ? SignalKind.Rising : SignalKind.Falling, $"{t.FirstHourAvg} → {t.LastHourAvg} {t.Unit} in 24 h"));
            }
        }
        if (latest is { IsAnomaly: true, IsFresh: true })
        {
            var top = latest.TopDeviations.FirstOrDefault();
            var feature = top?.Feature ?? "";
            var suffix = feature.Split('_')[0];
            var measurement = trends.FirstOrDefault(t => AnomalyScoringService.Suffix(t.SensorId) == suffix)?.Measurement ?? suffix;
            patterns.Add($"ML statistical anomaly in the last 60 minutes (largest deviation: {feature}, z = {top?.ZScore:0.#}).");
            signals.Add(new(suffix, measurement, SignalKind.MlAnomaly, $"anomaly score {latest.Score:0.###} (threshold {latest.Threshold:0.###})"));
        }
        if (patterns.Count == 0) patterns.Add("No notable trend or anomaly in the last 24 h.");
        return (patterns, signals);
    }

    static List<string> DataQuality(ReadingsResponse series, MachineDetailDto detail, AnomalyScoreDto? latest, MachineSummaryDto m)
    {
        var warnings = new List<string>();
        var expected = (int)(TimeSpan.FromHours(24).TotalSeconds / series.BucketSeconds);
        foreach (var s in series.Sensors)
        {
            var coverage = (double)s.Points.Count / expected;
            if (coverage < 0.9) warnings.Add($"{s.Measurement}: data for only {coverage:P0} of 5-minute intervals in the last 24 h.");
        }
        foreach (var s in detail.Sensors.Where(s => s.State == "Missing"))
            warnings.Add($"{s.Measurement}: no reading in the last 5 minutes — status cannot be Normal.");
        if (m.IsFlaggedOffline) warnings.Add("Machine is flagged offline; no live data and no ML scoring.");
        else if (latest is null) warnings.Add("No ML score in the last 24 h (service unavailable or insufficient data).");
        else if (!latest.IsFresh) warnings.Add($"Latest ML score is from {latest.TimestampUtc:u}; it may not reflect current conditions.");
        if (m.DataOrigin == DataOrigin.Synthetic) warnings.Add("All readings are SYNTHETIC demo data.");
        return warnings;
    }
}
