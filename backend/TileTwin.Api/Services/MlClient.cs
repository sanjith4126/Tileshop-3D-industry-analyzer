using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TileTwin.Api.Services;

public sealed record MlDeviation(string Feature, double Value, double ZScore);

public sealed record MlPrediction(
    string MachineId, string ModelVersion, double AnomalyScore, bool IsAnomaly, double Threshold,
    double? MaxFeatureZ, double? ZThreshold, IReadOnlyList<string> FeaturesUsed, IReadOnlyList<MlDeviation> TopDeviations, DateTime TimestampUtc);

public sealed record MlModelInfo(
    string Name, string MachineType, string Version, string Type, string Status, DateTime? TrainedUtc,
    int TrainWindows, double Threshold, JsonElement? Evaluation);

/// <summary>Outcome of a call: a value, "insufficient data" (with reasons) or "service unavailable". Never a fake score.</summary>
public sealed record MlResult<T>(T? Value, bool Unavailable, string? Problem);

/// <summary>Typed HTTP client for the Python ML service (timeouts and errors mapped to honest states).</summary>
public class MlClient(HttpClient http, ILogger<MlClient> log)
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { NumberHandling = JsonNumberHandling.AllowReadingFromString };

    public async Task<MlResult<MlPrediction>> PredictAsync(string machineId, string machineType,
        IReadOnlyDictionary<string, List<double>> readings, CancellationToken ct)
    {
        try
        {
            using var res = await http.PostAsJsonAsync("/predict", new { machineId, machineType, readings }, Json, ct);
            if (res.StatusCode == HttpStatusCode.UnprocessableEntity)
                return new(null, false, await res.Content.ReadAsStringAsync(ct));
            if (!res.IsSuccessStatusCode)
                return new(null, false, $"ML service returned {(int)res.StatusCode}");
            return new(await res.Content.ReadFromJsonAsync<MlPrediction>(Json, ct), false, null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            log.LogWarning("ML service unavailable: {Message}", ex.Message);
            return new(null, true, "ML service unavailable");
        }
    }

    public async Task<MlResult<List<MlModelInfo>>> ModelsAsync(CancellationToken ct)
    {
        try
        {
            return new(await http.GetFromJsonAsync<List<MlModelInfo>>("/models", Json, ct), false, null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException && !ct.IsCancellationRequested)
        {
            return new(null, true, "ML service unavailable");
        }
    }
}
