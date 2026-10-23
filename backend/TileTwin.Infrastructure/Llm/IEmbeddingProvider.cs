namespace TileTwin.Infrastructure.Llm;

/// <summary>
/// Text embeddings for semantic knowledge search. Configured by EMBEDDINGS__Provider.
/// No provider ships with the demo; without one, search uses PostgreSQL full-text (keyword) search.
/// To add one, implement this interface (e.g. a hosted embeddings API) and register it in Program.cs.
/// </summary>
public interface IEmbeddingProvider
{
    bool IsConfigured { get; }
    string Name { get; }
    Task<float[][]> EmbedAsync(IReadOnlyList<string> texts, CancellationToken ct);
}

public sealed class NotConfiguredEmbeddingProvider : IEmbeddingProvider
{
    public bool IsConfigured => false;
    public string Name => "none";
    public Task<float[][]> EmbedAsync(IReadOnlyList<string> texts, CancellationToken ct) =>
        throw new InvalidOperationException("Embeddings not configured");
}
