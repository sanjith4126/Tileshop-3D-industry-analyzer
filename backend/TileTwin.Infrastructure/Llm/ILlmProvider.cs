using System.Text.Json;

namespace TileTwin.Infrastructure.Llm;

public sealed record ChatTurn(string Role, string Text); // Role: "user" | "assistant"

/// <summary>A read-only tool the model may call. InputSchema is a JSON Schema object.</summary>
public sealed record LlmTool(string Name, string Description, JsonElement InputSchema);

public sealed record ToolCallRecord(string Name, string InputJson, bool IsError, int ResultChars);

public sealed record LlmResult(string Text, IReadOnlyList<ToolCallRecord> ToolCalls, string StopReason, bool ToolLimitReached);

/// <summary>Provider-neutral chat-with-tools. The provider runs the loop; tool execution stays in the app.</summary>
public interface ILlmProvider
{
    bool IsConfigured { get; }

    Task<LlmResult> RunAsync(string system, IReadOnlyList<ChatTurn> history, IReadOnlyList<LlmTool> tools,
        Func<string, JsonElement, CancellationToken, Task<(string Result, bool IsError)>> executeTool,
        int maxToolCalls, CancellationToken ct);
}
