using System.Net;
using System.Net.Http.Json;
using TileTwin.Api.Dtos;
using TileTwin.Api.Services;
using TileTwin.Domain;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

/// <summary>The test host points ML_SERVICE_URL at a closed port, so these cover the "ML unavailable" path.</summary>
[Collection(ApiCollection.Name)]
public class PredictiveTests(ApiFactory factory)
{
    [Fact]
    public async Task Predictive_view_for_HP002_has_patterns_rules_and_review_label_without_ML()
    {
        var d = await (await factory.SignedInClientAsync()).GetFromJsonAsync<PredictiveDto>("/api/predictive/MACHINE-HP-002", Json);

        Assert.Equal(PredictiveService.ReviewLabel, d!.ReviewLabel);
        Assert.StartsWith("Not implemented", d.FailurePrediction);
        Assert.Contains(d.PatternsObserved, p => p.StartsWith("Vibration rising"));
        Assert.Contains(d.SuggestedActions, s => s.RuleId == "R-VIB-02");
        Assert.Contains(d.SuggestedActions, s => s.RuleId == "R-TMP-01");
        Assert.Null(d.LatestScore);                         // never a fake score
        Assert.Contains(d.DataQualityWarnings, w => w.Contains("SYNTHETIC"));
        Assert.NotEmpty(d.OpenAlerts);
    }

    [Fact]
    public async Task Pump002_gets_missing_data_rule()
    {
        var d = await (await factory.SignedInClientAsync()).GetFromJsonAsync<PredictiveDto>("/api/predictive/MACHINE-PUMP-002", Json);
        Assert.Contains(d!.SuggestedActions, s => s.RuleId == "R-DAT-01");
        Assert.Contains(d.DataQualityWarnings, w => w.StartsWith("Flow"));
    }

    [Fact]
    public async Task On_demand_score_requires_sign_in_and_reports_unavailable_honestly()
    {
        var client = factory.CreateClient();
        const string url = "/api/predictive/MACHINE-HP-001/score";
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync(url, null)).StatusCode);

        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.PlantManager));
        var r = await (await client.PostAsync(url, null)).Content.ReadFromJsonAsync<ScoreResultDto>(Json);
        Assert.True(r!.MlUnavailable);
        Assert.Null(r.Score);

        var status = await client.GetStringAsync("/api/ml/status");
        Assert.Contains("\"available\":false", status);
    }
}
