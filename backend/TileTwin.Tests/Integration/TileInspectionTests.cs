using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

/// <summary>The test host's ML URL is unreachable, so classification honestly reports "ML service unavailable".</summary>
[Collection(ApiCollection.Name)]
public class TileInspectionTests(ApiFactory factory)
{
    static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    static MultipartFormDataContent Form(byte[] bytes, string name, string claimedType = "image/png")
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(claimedType);
        return new MultipartFormDataContent { { file, "file", name } };
    }

    [Fact]
    public void Sniff_checks_magic_bytes_not_names()
    {
        Assert.Equal("image/png", TileInspectionService.Sniff(Png)!.Value.ContentType);
        Assert.Equal("image/jpeg", TileInspectionService.Sniff([0xFF, 0xD8, 0xFF, 0xE0])!.Value.ContentType);
        Assert.Null(TileInspectionService.Sniff("GIF89a"u8));
        Assert.Null(TileInspectionService.Sniff([]));
    }

    [Fact]
    public async Task Upload_requires_inspection_role()
    {
        var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/tile-inspections", Form(Png, "t.png"))).StatusCode);
        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Viewer));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync("/api/tile-inspections", Form(Png, "t.png"))).StatusCode);
    }

    [Fact]
    public async Task Disguised_and_oversized_files_are_rejected()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Inspector));

        var fake = await client.PostAsync("/api/tile-inspections", Form("<script>alert(1)</script>"u8.ToArray(), "evil.png"));
        Assert.Equal(HttpStatusCode.BadRequest, fake.StatusCode);
        Assert.Contains("checked by file content", await fake.Content.ReadAsStringAsync());

        var big = new byte[TileInspectionService.MaxBytes + 1];
        Png.CopyTo(big, 0);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/tile-inspections", Form(big, "big.png"))).StatusCode);
    }

    [Fact]
    public async Task Valid_image_is_stored_and_reported_honestly_when_ML_is_down()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", await LoginAsync(client, Roles.Inspector));

        var res = await client.PostAsync("/api/tile-inspections", Form(Png, "../../tile 01.png", "application/octet-stream"));
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var t = (await res.Content.ReadFromJsonAsync<TileInspectionDto>(Json))!;

        Assert.Equal(TileResultStatus.MlUnavailable, t.Outcome);
        Assert.Null(t.Label);                                  // no invented result
        Assert.Equal("tile 01.png", t.OriginalFileName);       // path stripped
        Assert.Equal("image/png", t.ContentType);              // from content, not the claimed type
        var img = await client.GetAsync(t.ImageUrl);
        Assert.Equal(Png, await img.Content.ReadAsByteArrayAsync());
        Assert.Contains(await client.GetFromJsonAsync<List<TileInspectionDto>>("/api/tile-inspections", Json) ?? [], x => x.Id == t.Id);
        Assert.Contains("\"mlAvailable\":false", await client.GetStringAsync("/api/tile-inspections/status"));
    }
}
