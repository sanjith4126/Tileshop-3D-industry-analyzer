namespace TileTwin.Api.Configuration;

public sealed record FeatureStatus(bool Ai, bool Embeddings, string MlServiceUrl, bool DevUsers);

/// <summary>Reads and validates configuration once at startup.</summary>
public sealed class AppConfig
{
    public required string ConnectionString { get; init; }
    public required string JwtSigningKey { get; init; }
    public string? AnthropicApiKey { get; init; }
    public string? LlmModel { get; init; }
    public string? EmbeddingsProvider { get; init; }
    public required string MlServiceUrl { get; init; }
    public string? DevSeedUserPassword { get; init; }

    public const string JwtIssuer = "TileTwin";
    public const string JwtAudience = "TileTwin";

    public FeatureStatus Features(bool isDevelopment) => new(
        Ai: !string.IsNullOrWhiteSpace(AnthropicApiKey) && !string.IsNullOrWhiteSpace(LlmModel),
        Embeddings: false, // no IEmbeddingProvider implementation ships; EMBEDDINGS__Provider alone does not enable it
        MlServiceUrl: MlServiceUrl,
        DevUsers: isDevelopment && !string.IsNullOrWhiteSpace(DevSeedUserPassword));

    public static AppConfig Load(IConfiguration c)
    {
        var errors = new List<string>();
        var conn = c["POSTGRES_CONNECTION"];
        if (string.IsNullOrWhiteSpace(conn)) errors.Add("POSTGRES_CONNECTION is not set");

        var jwt = c["JWT:SigningKey"];
        if (string.IsNullOrWhiteSpace(jwt) || jwt.Length < 32 || jwt.Contains("<"))
            errors.Add("JWT__SigningKey must be set to a random value of at least 32 characters");

        if (errors.Count > 0)
            throw new InvalidOperationException("Invalid configuration (see .env.example): " + string.Join("; ", errors));

        return new AppConfig
        {
            ConnectionString = conn!,
            JwtSigningKey = jwt!,
            AnthropicApiKey = c["ANTHROPIC_API_KEY"],
            LlmModel = c["LLM:Model"],
            EmbeddingsProvider = c["EMBEDDINGS:Provider"],
            MlServiceUrl = string.IsNullOrWhiteSpace(c["ML_SERVICE_URL"]) ? "http://localhost:8001" : c["ML_SERVICE_URL"]!,
            DevSeedUserPassword = c["DEV_SEED_USER_PASSWORD"],
        };
    }

    public void LogFeatureStatus(ILogger log, bool isDevelopment)
    {
        var f = Features(isDevelopment);
        if (!f.Ai) log.LogWarning("AI assistant DISABLED: ANTHROPIC_API_KEY and/or LLM__Model not set (UI shows AI NOT CONFIGURED)");
        if (!string.IsNullOrWhiteSpace(EmbeddingsProvider))
            log.LogWarning("EMBEDDINGS__Provider '{Provider}' is set but no embedding provider is implemented; using keyword search", EmbeddingsProvider);
        if (!f.Embeddings) log.LogWarning("Embeddings DISABLED: knowledge search uses PostgreSQL keyword search");
        if (!f.DevUsers) log.LogInformation("Dev seed users not created (needs Development + DEV_SEED_USER_PASSWORD)");
        log.LogInformation("ML service URL: {Url}", f.MlServiceUrl);
    }
}
