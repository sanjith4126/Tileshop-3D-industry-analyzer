using System.Text.Json;
using TileTwin.Domain;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

/// <summary>Prime directives 1 and 2: plant data is labelled synthetic, snapshots say when they were taken, and
/// missing data is never shown as a value.</summary>
[Collection(ApiCollection.Name)]
public class HonestDataTests(ApiFactory factory)
{
    async Task<JsonElement> GetAsync(string path)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.PlantManager));
        return JsonDocument.Parse(await client.GetStringAsync(path)).RootElement;
    }

    [Theory]
    [InlineData("/api/machines")]
    [InlineData("/api/machines/MACHINE-HP-002")]
    [InlineData("/api/machines/MACHINE-HP-002/readings?range=1h")]
    [InlineData("/api/zones")]
    [InlineData("/api/zones/ZONE-GLAZE-A")]
    [InlineData("/api/alerts")]
    [InlineData("/api/inspection/zones")]
    [InlineData("/api/observations")]
    [InlineData("/api/predictive")]
    [InlineData("/api/predictive/MACHINE-HP-002")]
    [InlineData("/api/ml/status")]
    [InlineData("/api/overview")]
    public async Task Plant_data_responses_are_classified_synthetic(string path)
    {
        var root = await GetAsync(path);
        var items = root.ValueKind == JsonValueKind.Array ? root.EnumerateArray().ToList() : [root];
        Assert.NotEmpty(items);
        Assert.All(items, i => Assert.Equal("SYNTHETIC", i.GetProperty("dataClassification").GetString()));
    }

    [Theory]
    [InlineData("/api/overview")]
    [InlineData("/api/machines/MACHINE-HP-002")]
    [InlineData("/api/predictive/MACHINE-HP-002")]
    public async Task Snapshot_responses_say_when_they_were_generated(string path)
    {
        var generated = (await GetAsync(path)).GetProperty("generatedAt").GetDateTime();
        Assert.InRange(generated, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(1));
    }

    [Fact]
    public async Task Production_kpi_lists_every_day_and_has_no_rate_without_units()
    {
        var production = (await GetAsync("/api/overview")).GetProperty("production");
        var days = production.GetProperty("days").EnumerateArray().ToList();

        Assert.Equal(7, days.Count);
        Assert.All(days.Where(d => d.GetProperty("units").GetInt32() == 0),
            d => Assert.Equal(JsonValueKind.Null, d.GetProperty("ratePercent").ValueKind));
        Assert.True(production.GetProperty("fromUtc").GetDateTime() < production.GetProperty("toUtc").GetDateTime());
    }
}
