using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace TileTwin.Infrastructure.Llm;

/// <summary>Raised when an LLM provider returns an error; no answer is produced.</summary>
public sealed class LlmApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

/// <summary>
/// Groq (OpenAI-compatible chat completions with function calling), selected with LLM__Provider=groq
/// or when only GROQ_API_KEY is set. Same contract as the Anthropic provider: the app executes every
/// tool call, the per-question limit applies, and nothing is answered without a model response.
/// </summary>
public sealed class GroqLlmProvider(HttpClient http, string? apiKey, string? model) : ILlmProvider
{
    public const string DefaultModel = "openai/gpt-oss-120b";
    readonly string _model = string.IsNullOrWhiteSpace(model) ? DefaultModel : model;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(apiKey);
    public string Description => $"Groq · {_model}";

    public async Task<LlmResult> RunAsync(string system, IReadOnlyList<ChatTurn> history, IReadOnlyList<LlmTool> tools,
        Func<string, JsonElement, CancellationToken, Task<(string Result, bool IsError)>> executeTool,
        int maxToolCalls, CancellationToken ct)
    {
        if (!IsConfigured) throw new InvalidOperationException("LLM not configured");

        var messages = new JsonArray { new JsonObject { ["role"] = "system", ["content"] = system } };
        foreach (var t in history) messages.Add(new JsonObject { ["role"] = t.Role == "assistant" ? "assistant" : "user", ["content"] = t.Text });
        var toolDefs = new JsonArray(tools.Select(t => (JsonNode)new JsonObject
        {
            ["type"] = "function",
            ["function"] = new JsonObject { ["name"] = t.Name, ["description"] = t.Description, ["parameters"] = JsonNode.Parse(t.InputSchema.GetRawText()) },
        }).ToArray());

        var calls = new List<ToolCallRecord>();
        var limitReached = false;
        for (var round = 0; round <= maxToolCalls + 1; round++)
        {
            var body = new JsonObject
            {
                ["model"] = _model,
                ["messages"] = messages.DeepClone(),
                ["max_completion_tokens"] = 4096,
                ["temperature"] = 0.2,
            };
            if (tools.Count > 0)
            {
                body["tools"] = toolDefs.DeepClone();
                body["tool_choice"] = limitReached ? "none" : "auto";
            }

            using var req = new HttpRequestMessage(HttpMethod.Post, "chat/completions") { Content = JsonContent.Create(body) };
            req.Headers.Authorization = new("Bearer", apiKey);
            using var res = await http.SendAsync(req, ct);
            var text = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
                throw new LlmApiException((int)res.StatusCode, $"Groq returned {(int)res.StatusCode}: {Truncate(text)}");

            var message = JsonNode.Parse(text)?["choices"]?[0]?["message"] ?? throw new LlmApiException(502, "Groq response had no message");
            var toolCalls = message["tool_calls"]?.AsArray();
            if (toolCalls is null || toolCalls.Count == 0)
                return new LlmResult((message["content"]?.GetValue<string>() ?? "").Trim(), calls, "end_turn", limitReached);

            messages.Add(new JsonObject { ["role"] = "assistant", ["content"] = message["content"]?.DeepClone(), ["tool_calls"] = toolCalls.DeepClone() });
            foreach (var call in toolCalls)
            {
                var id = call!["id"]!.GetValue<string>();
                var name = call["function"]?["name"]?.GetValue<string>() ?? "";
                var argText = call["function"]?["arguments"]?.GetValue<string>() ?? "{}";
                string result;
                bool isError;
                JsonElement input;
                try { input = JsonDocument.Parse(string.IsNullOrWhiteSpace(argText) ? "{}" : argText).RootElement.Clone(); }
                catch (JsonException) { input = JsonDocument.Parse("{}").RootElement.Clone(); argText = "(invalid JSON)"; }

                if (calls.Count >= maxToolCalls)
                {
                    (result, isError) = ("Tool-call limit for this question reached. Answer with the information already gathered and say what is missing.", true);
                    limitReached = true;
                }
                else if (argText == "(invalid JSON)") (result, isError) = ("Invalid arguments: not valid JSON.", true);
                else (result, isError) = await executeTool(name, input, ct);

                calls.Add(new ToolCallRecord(name, argText, isError, result.Length));
                messages.Add(new JsonObject { ["role"] = "tool", ["tool_call_id"] = id, ["content"] = result });
            }
        }
        return new LlmResult("Stopped: too many tool rounds.", calls, "tool_rounds", true);
    }

    static string Truncate(string s) => s.Length > 300 ? s[..300] : s;
}
