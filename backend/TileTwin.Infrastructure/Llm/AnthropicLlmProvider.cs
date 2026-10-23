using System.Text.Json;
using Anthropic;
using Anthropic.Models.Beta.Messages;

namespace TileTwin.Infrastructure.Llm;

/// <summary>
/// Claude via the official Anthropic SDK (beta Messages endpoint, for server-side refusal fallback).
/// Manual tool loop so the app controls tool execution, the per-turn call limit and auditing.
/// </summary>
public sealed class AnthropicLlmProvider(string? apiKey, string? model) : ILlmProvider
{
    // Server-side refusal fallback, on by default: "default" routes a policy decline to a suitable model in the same call.
    const string FallbackBeta = "server-side-fallback-2026-07-01";

    readonly AnthropicClient? _client = string.IsNullOrWhiteSpace(apiKey) ? null : new AnthropicClient { ApiKey = apiKey };

    public bool IsConfigured => _client is not null && !string.IsNullOrWhiteSpace(model);

    public async Task<LlmResult> RunAsync(string system, IReadOnlyList<ChatTurn> history, IReadOnlyList<LlmTool> tools,
        Func<string, JsonElement, CancellationToken, Task<(string Result, bool IsError)>> executeTool,
        int maxToolCalls, CancellationToken ct)
    {
        if (!IsConfigured) throw new InvalidOperationException("LLM not configured");

        var messages = history.Select(t => t.Role == "assistant"
            ? (BetaMessageParam)new BetaAssistantMessageParam { Content = t.Text }
            : new BetaUserMessageParam { Content = t.Text }).ToList();
        var toolDefs = tools.Select(t => (BetaToolUnion)new BetaTool
        {
            Name = t.Name,
            Description = t.Description,
            Strict = true,
            InputSchema = new InputSchema
            {
                Properties = t.InputSchema.GetProperty("properties").EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone()),
                Required = t.InputSchema.TryGetProperty("required", out var req) ? req.EnumerateArray().Select(r => r.GetString()!).ToList() : [],
            },
        }).ToList();

        var calls = new List<ToolCallRecord>();
        var limitReached = false;
        for (var round = 0; round <= maxToolCalls + 1; round++)
        {
            var p = new MessageCreateParams
            {
                Model = model!,
                MaxTokens = 16000,
                System = system,
                Messages = messages,
                Tools = toolDefs,
                ToolChoice = limitReached ? new BetaToolChoiceNone() : new BetaToolChoiceAuto(),
                OutputConfig = new BetaOutputConfig { Effort = Effort.Medium },
                Betas = [FallbackBeta],
                Fallbacks = new Default(),
            };
            BetaMessage response = await _client!.Beta.Messages.Create(p, ct);

            var assistant = new List<BetaContentBlockParam>();
            var results = new List<BetaContentBlockParam>();
            var text = new List<string>();
            foreach (var block in response.Content)
            {
                if (block.TryPickText(out var t)) { assistant.Add(new BetaTextBlockParam { Text = t.Text }); text.Add(t.Text); }
                else if (block.TryPickThinking(out var th)) assistant.Add(new BetaThinkingBlockParam { Thinking = th.Thinking, Signature = th.Signature });
                else if (block.TryPickRedactedThinking(out var rt)) assistant.Add(new BetaRedactedThinkingBlockParam { Data = rt.Data });
                // A refusal fallback leaves a marker block; echo it so the conversation continues on the fallback model.
                else if (block.TryPickFallback(out var fb)) assistant.Add(new BetaFallbackBlockParam
                {
                    From = new BetaFallbackInfoParam { Model = fb.From.Model },
                    To = new BetaFallbackInfoParam { Model = fb.To.Model },
                    Trigger = JsonSerializer.SerializeToElement(fb.Trigger),
                });
                else if (block.TryPickToolUse(out var tu))
                {
                    assistant.Add(new BetaToolUseBlockParam { ID = tu.ID, Name = tu.Name, Input = tu.Input });
                    var input = JsonSerializer.SerializeToElement(tu.Input);
                    string result;
                    bool isError;
                    if (calls.Count >= maxToolCalls)
                    {
                        (result, isError) = ("Tool-call limit for this question reached. Answer with the information already gathered and say what is missing.", true);
                        limitReached = true;
                    }
                    else (result, isError) = await executeTool(tu.Name, input, ct);
                    calls.Add(new ToolCallRecord(tu.Name, input.GetRawText(), isError, result.Length));
                    results.Add(new BetaToolResultBlockParam { ToolUseID = tu.ID, Content = result, IsError = isError });
                }
            }

            var stop = response.StopReason?.ToString() ?? "";
            if (stop.Contains("refusal", StringComparison.OrdinalIgnoreCase))
                return new LlmResult("The request was declined by the model's safety system.", calls, "refusal", limitReached);
            if (results.Count == 0)
                return new LlmResult(string.Join("\n", text).Trim(), calls, stop, limitReached);

            messages.Add(new BetaAssistantMessageParam { Content = assistant });
            messages.Add(new BetaUserMessageParam { Content = results });
        }
        return new LlmResult("Stopped: too many tool rounds.", calls, "tool_rounds", true);
    }
}
