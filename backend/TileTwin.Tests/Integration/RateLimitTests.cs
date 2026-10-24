using System.Net;
using System.Net.Http.Json;
using TileTwin.Api.Dtos;
using static TileTwin.Tests.Integration.ApiTests;

namespace TileTwin.Tests.Integration;

[Collection(ApiCollection.Name)]
public class RateLimitTests(ApiFactory factory)
{
    [Fact]
    public async Task Login_is_rate_limited_per_client()
    {
        Environment.SetEnvironmentVariable("RateLimiting__Disabled", "false"); // read when the new host starts
        try
        {
            using var app = factory.WithWebHostBuilder(_ => { });
            var client = app.CreateClient();
            var codes = new List<HttpStatusCode>();
            for (var i = 0; i < 12; i++)
                codes.Add((await client.PostAsJsonAsync("/api/auth/login", new LoginRequest($"nobody{i}@tiletwin.local", "wrong-password-123"), Json)).StatusCode);

            Assert.All(codes.Take(10), c => Assert.Equal(HttpStatusCode.Unauthorized, c));
            Assert.Equal(HttpStatusCode.TooManyRequests, codes[^1]);
        }
        finally
        {
            Environment.SetEnvironmentVariable("RateLimiting__Disabled", "true");
        }
    }
}
