using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Llm;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

/// <summary>Deterministic stand-in: bag-of-words hashed into 64 dims, so related texts are close.</summary>
sealed class HashEmbeddings : IEmbeddingProvider
{
    public bool IsConfigured => true;
    public string Name => "test-hash";

    public Task<float[][]> EmbedAsync(IReadOnlyList<string> texts, CancellationToken ct) => Task.FromResult(texts.Select(t =>
    {
        var v = new float[64];
        foreach (var w in t.ToLowerInvariant().Split([' ', '\n', '.', ',', ';', ':'], StringSplitOptions.RemoveEmptyEntries))
            v[(w.GetHashCode() & 0x7fffffff) % 64] += 1;
        v[0] += 0.01f; // never a zero vector
        return v;
    }).ToArray());
}

[Collection(ApiCollection.Name)]
public class KnowledgeTests(ApiFactory factory)
{
    static MultipartFormDataContent Form(byte[] bytes, string name, string? title = null)
    {
        var form = new MultipartFormDataContent { { new ByteArrayContent(bytes) { Headers = { ContentType = new MediaTypeHeaderValue("application/octet-stream") } }, "file", name } };
        if (title is not null) form.Add(new StringContent(title), "title");
        return form;
    }

    async Task<HttpClient> As(string role, WebApplicationFactoryClient? app = null)
    {
        var c = (app?.Factory ?? factory).CreateClient();
        c.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(c, role));
        return c;
    }

    sealed record WebApplicationFactoryClient(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> Factory);

    [Fact]
    public async Task Seeded_demo_documents_are_keyword_searchable_with_source_attribution()
    {
        var r = await factory.CreateClient().GetFromJsonAsync<SearchResult>("/api/documents/search?q=interlock bypassed", Json);
        Assert.Equal(KnowledgeService.KeywordMode, r!.Mode);
        var hit = Assert.Single(r.Hits, h => h.DocumentTitle.StartsWith("Glaze line safety"));
        Assert.Contains("«", hit.Snippet);
        Assert.Contains("keyword search (embeddings not configured)", await factory.CreateClient().GetStringAsync("/api/documents"));
    }

    [Fact]
    public async Task Upload_txt_and_pdf_index_search_reindex_and_delete()
    {
        var inspector = await As(Roles.Inspector);
        var txt = await inspector.PostAsync("/api/documents", Form("Kiln roller lubrication: grease the zirconium rollers weekly.\n\nCheck drive chain."u8.ToArray(), "kiln.txt", "Kiln rollers"));
        Assert.Equal(HttpStatusCode.OK, txt.StatusCode);
        var doc = (await txt.Content.ReadFromJsonAsync<DocumentDto>(Json))!;
        Assert.Equal((DocumentStatus.Indexed, 1, "Kiln rollers"), (doc.Status, doc.ChunkCount, doc.Title));

        QuestPDF.Settings.License = LicenseType.Community;
        var pdfBytes = QuestPDF.Fluent.Document.Create(d => d.Page(p => p.Content().Text("Pump cavitation troubleshooting: check the suction strainer."))).GeneratePdf();
        var pdf = (await (await inspector.PostAsync("/api/documents", Form(pdfBytes, "pump.pdf"))).Content.ReadFromJsonAsync<DocumentDto>(Json))!;
        Assert.Equal("application/pdf", pdf.ContentType);

        var found = await inspector.GetFromJsonAsync<SearchResult>("/api/documents/search?q=cavitation strainer", Json);
        Assert.Contains(found!.Hits, h => h.DocumentId == pdf.Id);

        Assert.Equal(HttpStatusCode.OK, (await inspector.PostAsync($"/api/documents/{doc.Id}/reindex", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await inspector.DeleteAsync($"/api/documents/{doc.Id}")).StatusCode);
        var engineer = await As(Roles.MaintenanceEngineer);
        Assert.Equal(HttpStatusCode.NoContent, (await engineer.DeleteAsync($"/api/documents/{doc.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await engineer.DeleteAsync($"/api/documents/{pdf.Id}")).StatusCode);
        var after = await inspector.GetFromJsonAsync<SearchResult>("/api/documents/search?q=zirconium", Json);
        Assert.Empty(after!.Hits);
    }

    [Fact]
    public async Task Binary_or_wrong_type_files_are_rejected_and_viewers_cannot_upload()
    {
        var viewer = await As(Roles.Viewer);
        Assert.Equal(HttpStatusCode.Forbidden, (await viewer.PostAsync("/api/documents", Form("x"u8.ToArray(), "a.txt"))).StatusCode);

        var inspector = await As(Roles.Inspector);
        var exe = await inspector.PostAsync("/api/documents", Form([0x4D, 0x5A, 0x00, 0x01, 0x02], "notes.txt"));
        Assert.Equal(HttpStatusCode.BadRequest, exe.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await inspector.PostAsync("/api/documents", Form(Encoding.UTF8.GetBytes("hello"), "a.docx"))).StatusCode);
    }

    [Fact]
    public async Task With_an_embedding_provider_search_switches_to_semantic()
    {
        using var app = factory.WithWebHostBuilder(b => b.ConfigureTestServices(s => s.AddSingleton<IEmbeddingProvider, HashEmbeddings>()));
        var c = await As(Roles.MaintenanceEngineer, new WebApplicationFactoryClient(app));
        var doc = (await (await c.PostAsync("/api/documents", Form("Conveyor belt tension adjustment procedure for the glazing line."u8.ToArray(), "belt.md")))
            .Content.ReadFromJsonAsync<DocumentDto>(Json))!;
        try
        {
            Assert.True(doc.Embedded);
            var r = await c.GetFromJsonAsync<SearchResult>("/api/documents/search?q=belt tension", Json);
            Assert.Equal("semantic search (test-hash)", r!.Mode);
            Assert.Equal(doc.Id, r.Hits[0].DocumentId);
        }
        finally
        {
            await c.DeleteAsync($"/api/documents/{doc.Id}");
        }
    }
}
