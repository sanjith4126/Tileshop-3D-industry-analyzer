using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using TileTwin.Infrastructure.Llm;

namespace TileTwin.Tests.Domain;

/// <summary>Groq tool loop against a fake HTTP handler (no network).</summary>
public class GroqLlmProviderTests
{
    sealed class FakeGroq(params string[] responses) : HttpMessageHandler
    {
        int _i;
        public List<JsonNode> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Requests.Add(JsonNode.Parse(await request.Content!.ReadAsStringAsync(ct))!);
            Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(responses[_i++], Encoding.UTF8, "application/json") };
        }
    }

    static string ToolCall(string id, string name, string args) => JsonSerializer.Serialize(new
    {
        choices = new[] { new { message = new { role = "assistant", content = (string?)null, tool_calls = new[] { new { id, type = "function", function = new { name, arguments = args } } } } } },
    });

    static string Answer(string text) => JsonSerializer.Serialize(new { choices = new[] { new { message = new { role = "assistant", content = text } } } });

    static readonly LlmTool[] Tools = [new("list_alerts", "alerts", JsonDocument.Parse("""{"type":"object","properties":{"machineId":{"type":["string","null"]}},"required":["machineId"],"additionalProperties":false}""").RootElement)];

    static GroqLlmProvider Provider(FakeGroq fake) => new(new HttpClient(fake) { BaseAddress = new Uri("https://example.test/v1/") }, "test-key", null);

    [Fact]
    public async Task Executes_tool_calls_then_returns_the_answer()
    {
        var fake = new FakeGroq(ToolCall("c1", "list_alerts", """{"machineId":"MACHINE-HP-002"}"""), Answer("HP-002 has a critical alert."));
        var executed = new List<(string, string)>();

        var r = await Provider(fake).RunAsync("sys", [new ChatTurn("user", "alerts?")], Tools,
            (name, input, _) => { executed.Add((name, input.GetProperty("machineId").GetString()!)); return Task.FromResult(("{\"alerts\":1}", false)); }, 6, default);

        Assert.Equal("HP-002 has a critical alert.", r.Text);
        Assert.Equal([("list_alerts", "MACHINE-HP-002")], executed);
        Assert.Equal(GroqLlmProvider.DefaultModel, fake.Requests[0]["model"]!.GetValue<string>());
        Assert.Equal("function", fake.Requests[0]["tools"]![0]!["type"]!.GetValue<string>());
        var second = fake.Requests[1]["messages"]!.AsArray();
        Assert.Equal("tool", second[^1]!["role"]!.GetValue<string>());
        Assert.Equal("c1", second[^1]!["tool_call_id"]!.GetValue<string>());
    }

    [Fact]
    public async Task Stops_executing_after_the_tool_call_limit_and_forces_an_answer()
    {
        var fake = new FakeGroq(ToolCall("a", "list_alerts", "{}"), ToolCall("b", "list_alerts", "{}"), Answer("done"));
        var count = 0;

        var r = await Provider(fake).RunAsync("sys", [new ChatTurn("user", "q")], Tools,
            (_, _, _) => { count++; return Task.FromResult(("ok", false)); }, 1, default);

        Assert.Equal(1, count);
        Assert.True(r.ToolLimitReached);
        Assert.Equal("none", fake.Requests[2]["tool_choice"]!.GetValue<string>());
        Assert.Equal("done", r.Text);
    }

    [Fact]
    public async Task Invalid_argument_json_is_returned_as_an_error_not_executed()
    {
        var fake = new FakeGroq(ToolCall("x", "list_alerts", "{not json"), Answer("sorry"));
        var executed = false;
        var r = await Provider(fake).RunAsync("sys", [new ChatTurn("user", "q")], Tools, (_, _, _) => { executed = true; return Task.FromResult(("", false)); }, 6, default);

        Assert.False(executed);
        Assert.True(r.ToolCalls[0].IsError);
    }

    [Fact]
    public async Task Without_a_key_it_is_not_configured() =>
        Assert.False(new GroqLlmProvider(new HttpClient(), " ", null).IsConfigured);
}
