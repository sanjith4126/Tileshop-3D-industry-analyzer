using Anthropic.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TileTwin.Api.Assistant;
using TileTwin.Infrastructure.Llm;

namespace TileTwin.Api.Controllers;

[ApiController, Route("api/assistant")]
public class AssistantController(AssistantService assistant, ILlmProvider llm, ILogger<AssistantController> log) : ControllerBase
{
    public const string NotConfigured = "AI NOT CONFIGURED — set GROQ_API_KEY, or ANTHROPIC_API_KEY and LLM__Model";

    [HttpGet("status")]
    public IActionResult Status() => Ok(new { configured = llm.IsConfigured, model = llm.IsConfigured ? llm.Description : null, message = llm.IsConfigured ? null : NotConfigured });

    [HttpPost("chat"), Authorize, EnableRateLimiting("assistant"), Microsoft.AspNetCore.Http.Timeouts.RequestTimeout("long")]
    public async Task<IActionResult> Chat(ChatRequest req, CancellationToken ct)
    {
        if (!llm.IsConfigured) return StatusCode(503, new { configured = false, error = NotConfigured });
        if (req.Messages[^1].Role != "user") return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["messages"] = ["Last message must be from the user"] }));
        try
        {
            return Ok(await assistant.ChatAsync(req, User.Identity!.Name!, ct));
        }
        catch (AnthropicApiException ex)
        {
            log.LogWarning("LLM call failed: {Message}", ex.Message);
            return StatusCode(502, new { error = "The AI service returned an error. No answer was generated." });
        }
        catch (LlmApiException ex)
        {
            log.LogWarning("LLM call failed: {Message}", ex.Message);
            return StatusCode(502, new { error = ex.Status == 429 ? "The AI service rate limit was reached. Try again in a minute." : "The AI service returned an error. No answer was generated." });
        }
        catch (HttpRequestException ex)
        {
            log.LogWarning("LLM unreachable: {Message}", ex.Message);
            return StatusCode(502, new { error = "The AI service is unreachable. No answer was generated." });
        }
    }
}
