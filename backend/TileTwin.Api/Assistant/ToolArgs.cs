using System.Text.Json;
using System.Text.RegularExpressions;

namespace TileTwin.Api.Assistant;

/// <summary>Thrown for invalid tool arguments; returned to the model as an error tool result.</summary>
public sealed class ToolArgumentException(string message) : Exception(message);

/// <summary>Validating reader for tool inputs (the model's arguments are untrusted).</summary>
public sealed partial class ToolArgs(JsonElement input)
{
    [GeneratedRegex("^[A-Z0-9-]{1,64}$")]
    private static partial Regex IdPattern();

    JsonElement? Get(string name) =>
        input.ValueKind == JsonValueKind.Object && input.TryGetProperty(name, out var v) && v.ValueKind != JsonValueKind.Null ? v : null;

    public string? OptString(string name, int maxLength = 100)
    {
        if (Get(name) is not { } v) return null;
        if (v.ValueKind != JsonValueKind.String) throw new ToolArgumentException($"{name} must be a string");
        var s = v.GetString()!.Trim();
        if (s.Length > maxLength) throw new ToolArgumentException($"{name} longer than {maxLength} characters");
        return s.Length == 0 ? null : s;
    }

    public string? OptId(string name)
    {
        var s = OptString(name, 64)?.ToUpperInvariant();
        if (s is not null && !IdPattern().IsMatch(s)) throw new ToolArgumentException($"{name} is not a valid ID");
        return s;
    }

    public string Id(string name) => OptId(name) ?? throw new ToolArgumentException($"{name} is required");

    public int Int(string name, int min, int max, int fallback)
    {
        if (Get(name) is not { } v) return fallback;
        if (v.ValueKind != JsonValueKind.Number || !v.TryGetInt32(out var i)) throw new ToolArgumentException($"{name} must be an integer");
        if (i < min || i > max) throw new ToolArgumentException($"{name} must be between {min} and {max}");
        return i;
    }

    public T? OptEnum<T>(string name) where T : struct, Enum
    {
        var s = OptString(name, 40);
        if (s is null) return null;
        return Enum.TryParse<T>(s, ignoreCase: true, out var e) && Enum.IsDefined(e)
            ? e : throw new ToolArgumentException($"{name} must be one of {string.Join(", ", Enum.GetNames<T>())}");
    }

    /// <summary>Builds a strict JSON schema: every property listed as required, optional ones nullable.</summary>
    public static JsonElement Schema(params (string Name, string Type, string Description, bool Nullable, string[]? Enum)[] props)
    {
        var properties = props.ToDictionary(p => p.Name, p =>
        {
            var d = new Dictionary<string, object> { ["type"] = p.Nullable ? new[] { p.Type, "null" } : p.Type, ["description"] = p.Description };
            if (p.Enum is not null) d["enum"] = p.Nullable ? [.. p.Enum, null!] : p.Enum;
            return d;
        });
        return JsonSerializer.SerializeToElement(new { type = "object", properties, required = props.Select(p => p.Name).ToArray(), additionalProperties = false });
    }
}
