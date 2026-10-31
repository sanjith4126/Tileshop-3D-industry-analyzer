using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TileTwin.Api.Reports;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

[Collection(ApiCollection.Name)]
public class ReportTests(ApiFactory factory)
{
    async Task<HttpClient> SignedIn()
    {
        var c = factory.CreateClient();
        c.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(c, Roles.Viewer));
        return c;
    }

    [Fact]
    public async Task Creating_a_report_requires_sign_in()
    {
        var res = await factory.CreateClient().PostAsJsonAsync("/api/reports", new ReportRequest(ReportType.FactoryHealth, null, null, null, null), Json);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Theory]
    [InlineData(ReportType.FactoryHealth, "MACHINE-HP-002")]
    [InlineData(ReportType.MachineAnomalies, "SENSOR-HP-002-VIB")]
    [InlineData(ReportType.MaintenanceHistory, "MACHINE-HP-002")]
    [InlineData(ReportType.SiteInspection, "OBS-")]
    public async Task Each_required_report_type_builds_from_records_and_renders_pdf(ReportType type, string expectedInContent)
    {
        var client = await SignedIn();
        var res = await client.PostAsJsonAsync("/api/reports", new ReportRequest(type, null, null, null, null), Json);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        var r = JsonSerializer.Deserialize<ReportDto>(body, Json)!;

        Assert.Contains("\"dataClassification\":\"SYNTHETIC\"", body);
        Assert.NotEmpty(r.Document.Summary);
        Assert.NotEmpty(r.Document.Recommendations);
        var all = string.Join(" ", r.Document.Sections.SelectMany(s => (s.Table?.Rows ?? []).SelectMany(x => x)));
        Assert.Contains(expectedInContent, all);

        var pdf = await client.GetAsync($"/api/reports/{r.Id}/pdf");
        Assert.Equal("application/pdf", pdf.Content.Headers.ContentType!.MediaType);
        var bytes = await pdf.Content.ReadAsByteArrayAsync();
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));

        var list = await client.GetFromJsonAsync<List<ReportListItem>>("/api/reports", Json);
        Assert.Contains(list!, x => x.Id == r.Id);
    }

    [Fact]
    public async Task Empty_period_produces_valid_no_records_report()
    {
        var client = await SignedIn();
        var from = new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var res = await client.PostAsJsonAsync("/api/reports", new ReportRequest(ReportType.MaintenanceHistory, from, from.AddDays(7), null, null), Json);
        var r = (await res.Content.ReadFromJsonAsync<ReportDto>(Json))!;

        Assert.Contains(ReportBuilder.NoRecords, r.Document.Summary);
        Assert.Contains(ReportBuilder.NoRecords, r.Document.Sections[0].Paragraphs);
        Assert.Null(r.Document.Sections[0].Table);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/reports/{r.Id}/pdf")).StatusCode);
    }

    [Fact]
    public async Task Invalid_period_is_rejected()
    {
        var client = await SignedIn();
        var now = DateTime.UtcNow;
        var res = await client.PostAsJsonAsync("/api/reports", new ReportRequest(ReportType.FactoryHealth, now, now.AddDays(-1), null, null), Json);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }
}
