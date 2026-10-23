using System.Net;
using System.Net.Http.Json;
using TileTwin.Api.Dtos;
using TileTwin.Domain;
using TileTwin.Domain.Inspections;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

[Collection(ApiCollection.Name)]
public class InspectionTests(ApiFactory factory)
{
    const string Glaze = "ZONE-GLAZE-A";

    [Fact]
    public async Task Zones_list_counts_and_filters_work()
    {
        var client = factory.CreateClient();
        var zones = await client.GetFromJsonAsync<List<InspectionZoneDto>>("/api/inspection/zones", Json);
        Assert.Equal(25, zones!.Sum(z => z.Total));
        Assert.True(zones.Single(z => z.Id == Glaze).OpenHighPriority >= 2);

        var high = await client.GetFromJsonAsync<List<ObservationSummaryDto>>($"/api/observations?zoneId={Glaze}&priority=High&status=Open", Json);
        Assert.NotEmpty(high!);
        Assert.All(high!, o => Assert.Equal((Glaze, ObservationPriority.High, ObservationStatus.Open), (o.ZoneId, o.Priority, o.Status)));

        var search = await client.GetFromJsonAsync<List<ObservationSummaryDto>>("/api/observations?q=interlock", Json);
        Assert.Single(search!);
    }

    [Fact]
    public async Task Detail_has_actions_history_and_labelled_placeholder_attachment()
    {
        var client = factory.CreateClient();
        var obs = (await client.GetFromJsonAsync<List<ObservationSummaryDto>>("/api/observations?q=interlock", Json))!.Single();
        var d = await client.GetFromJsonAsync<ObservationDetailDto>($"/api/observations/{obs.Id}", Json);

        Assert.Equal(2, d!.CorrectiveActions.Count);
        Assert.Contains(d.History, h => h.Action == "Created");
        var att = Assert.Single(d.Attachments);
        Assert.True(att.IsPlaceholder);
        var svg = await client.GetAsync(att.Url);
        Assert.Equal("image/svg+xml", svg.Content.Headers.ContentType!.MediaType);
        Assert.Contains("SYNTHETIC PLACEHOLDER IMAGE", await svg.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Update_requires_inspector_or_admin_and_records_history()
    {
        var client = factory.CreateClient();
        var obs = (await client.GetFromJsonAsync<List<ObservationSummaryDto>>("/api/observations?q=sump", Json))!.Single();
        // Values differ from the current state on every run (the test DB keeps user-created history between runs).
        var newStatus = obs.Status == ObservationStatus.InProgress ? ObservationStatus.Open : ObservationStatus.InProgress;
        var assignee = $"engineer-{Guid.NewGuid():N}@tiletwin.local";
        var req = new UpdateObservationRequest(newStatus, Roles.MaintenanceEngineer, assignee, "Pump-out booked");
        var url = $"/api/observations/{obs.Id}";

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PatchAsJsonAsync(url, req, Json)).StatusCode);
        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.MaintenanceEngineer));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PatchAsJsonAsync(url, req, Json)).StatusCode);

        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Inspector));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PatchAsJsonAsync(url, req with { AssignedRole = "Boss" }, Json)).StatusCode);
        var updated = await (await client.PatchAsJsonAsync(url, req, Json)).Content.ReadFromJsonAsync<ObservationDetailDto>(Json);

        Assert.Equal(newStatus, updated!.Observation.Status);
        Assert.Equal(assignee, updated.Observation.AssignedUser);
        var mine = updated.History.Where(h => h.TimestampUtc == updated.Observation.UpdatedUtc).ToList();
        Assert.All(mine, h => Assert.Equal("dev.inspector@tiletwin.local", h.UserName));
        Assert.Contains(mine, h => h.Action == "Status changed" && h.Details!.EndsWith(newStatus.ToString()));
        Assert.Contains(mine, h => h.Action == "Assigned" && h.Details == $"User: {assignee}");
        Assert.Contains(mine, h => h.Action == "Comment" && h.Details == "Pump-out booked");
    }

    [Fact]
    public async Task Summary_cites_open_high_priority_glazing_items()
    {
        var res = await factory.CreateClient().PostAsJsonAsync("/api/inspection/summary", new InspectionSummaryRequest(Glaze), Json);
        var s = await res.Content.ReadFromJsonAsync<InspectionSummary>(Json);

        Assert.StartsWith("Glazing & Inspection", s!.Scope);
        Assert.True(s.OpenHighPriority.Count >= 2);
        Assert.Contains(s.OpenHighPriority, h => h.Priority == ObservationPriority.Critical);
        Assert.Contains(s.OpenHighPriority[0].Code, string.Join(" ", s.Lines));
        Assert.True(s.ContainsSyntheticData);
        Assert.Equal(HttpStatusCode.NotFound,
            (await factory.CreateClient().PostAsJsonAsync("/api/inspection/summary", new InspectionSummaryRequest("ZONE-NOPE"), Json)).StatusCode);
    }
}
