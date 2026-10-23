using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TileTwin.Api.Assistant;
using TileTwin.Api.Workflows;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Llm;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

/// <summary>Scripted stand-in for the LLM: calls the given tools in order, then answers with fixed text.</summary>
sealed class ScriptedLlm(params (string Tool, string InputJson)[] calls) : ILlmProvider
{
    public bool IsConfigured => true;
    public List<(string Result, bool IsError)> Results { get; } = [];

    public async Task<LlmResult> RunAsync(string system, IReadOnlyList<ChatTurn> history, IReadOnlyList<LlmTool> tools,
        Func<string, JsonElement, CancellationToken, Task<(string Result, bool IsError)>> executeTool, int maxToolCalls, CancellationToken ct)
    {
        var records = new List<ToolCallRecord>();
        foreach (var (tool, json) in calls.Take(maxToolCalls))
        {
            var r = await executeTool(tool, JsonDocument.Parse(json).RootElement, ct);
            Results.Add(r);
            records.Add(new ToolCallRecord(tool, json, r.IsError, r.Result.Length));
        }
        return new LlmResult("MACHINE-HP-002 has open critical alerts (fact). Hypothesis: bearing wear. Also MACHINE-NOPE-9.", records, "end_turn", false);
    }
}

[Collection(ApiCollection.Name)]
public class AssistantWorkflowTests(ApiFactory factory)
{
    [Fact]
    public async Task Without_a_key_the_assistant_reports_not_configured_and_gives_no_answer()
    {
        var client = factory.CreateClient();
        Assert.Contains("AI NOT CONFIGURED", await client.GetStringAsync("/api/assistant/status"));

        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Viewer));
        var res = await client.PostAsJsonAsync("/api/assistant/chat", new ChatRequest([new("user", "Which machines have active alerts?")]), Json);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, res.StatusCode);
        Assert.Contains("AI NOT CONFIGURED", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Tool_loop_validates_arguments_audits_calls_and_returns_known_focus_ids()
    {
        var llm = new ScriptedLlm(
            ("list_alerts", """{"machineId":null,"status":null}"""),
            ("get_readings_summary", """{"machineId":"MACHINE-HP-002","hours":24}"""),
            ("get_readings_summary", """{"machineId":"MACHINE-HP-002","hours":9999}"""),
            ("search_machines", """{"query":"'; DROP TABLE x;--","status":null,"zoneId":null}"""));
        using var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<ILlmProvider>(llm)));
        var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Viewer));

        var res = await client.PostAsJsonAsync("/api/assistant/chat", new ChatRequest([new("user", "Which machines have active alerts?")]), Json);
        var body = await res.Content.ReadFromJsonAsync<ChatResponse>(Json);

        Assert.Equal(["MACHINE-HP-002"], body!.FocusEntityIds);          // unknown IDs are dropped
        Assert.Contains("SENSOR-HP-002-VIB", llm.Results[0].Result);       // alert data reached the model
        Assert.Contains("SYNTHETIC", llm.Results[0].Result);
        Assert.Contains("\"percentBeyondWarning\"", llm.Results[1].Result);
        Assert.True(llm.Results[2].IsError);                               // hours out of range rejected
        Assert.Contains("between 1 and 168", llm.Results[2].Result);
        Assert.False(llm.Results[3].IsError);                              // odd text is just a non-matching search
        Assert.Equal("[]", JsonDocument.Parse(llm.Results[3].Result).RootElement.GetProperty("result").GetRawText());

        using var scope = factory.Services.CreateScope();
        var audited = await factory.CreateDbContext(scope).AuditLog.CountAsync(a => a.Action == "assistant.tool" && a.UserName == "dev.viewer@tiletwin.local");
        Assert.True(audited >= 4);
    }

    [Fact]
    public async Task Prioritisation_workflow_ranks_HP002_first_excludes_offline_and_stores_report()
    {
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/workflows/maintenance-prioritisation", new { }, Json)).StatusCode);
        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.MaintenanceEngineer));

        var res = await client.PostAsJsonAsync("/api/workflows/maintenance-prioritisation", new { zoneId = (string?)null, createReport = true, aiWording = false }, Json);
        var exec = (await res.Content.ReadFromJsonAsync<WorkflowExecutionDto>(Json))!;
        Assert.Equal(WorkflowStatus.Succeeded, exec.Status);
        var output = exec.Output!.Value.Deserialize<PrioritisationOutput>(Json)!;

        Assert.Equal("MACHINE-HP-002", output.Ranking[0].MachineId);
        Assert.StartsWith("Immediate", output.Ranking[0].Band);
        Assert.Contains(output.Ranking, r => r.MachineId == "MACHINE-PUMP-002" && r.Factors.Any(f => f.Factor.Contains("Unknown")));
        Assert.DoesNotContain(output.Ranking, r => r.MachineId == "MACHINE-CONV-003");
        Assert.Contains(output.Excluded, e => e.StartsWith("MACHINE-CONV-003"));
        Assert.Contains("MACHINE-HP-002", output.FocusEntityIds);
        Assert.Null(output.AiWording);
        Assert.NotNull(output.ReportId);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/reports/{output.ReportId}/pdf")).StatusCode);

        var bad = await client.PostAsJsonAsync("/api/workflows/maintenance-prioritisation", new { zoneId = "ZONE-NOPE", createReport = false, aiWording = false }, Json);
        Assert.Equal(WorkflowStatus.Failed, (await bad.Content.ReadFromJsonAsync<WorkflowExecutionDto>(Json))!.Status);
    }
}
