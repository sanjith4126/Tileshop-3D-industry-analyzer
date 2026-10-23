using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TileTwin.Api.Services;
using TileTwin.Domain;
using TileTwin.Domain.Entities;
using TileTwin.Infrastructure.Data;

namespace TileTwin.Api.Reports;

public class ReportService(TileTwinDbContext db, ReportBuilder builder, TimeProvider clock, AuditLogger audit)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
    public static readonly TimeSpan MaxPeriod = TimeSpan.FromDays(366);

    public static string? Validate(ReportRequest req, DateTime now)
    {
        if (req.Type == ReportType.MaintenancePrioritisation) return "This report is produced by the maintenance-prioritisation workflow";
        var (from, to) = Period(req, now);
        if (from >= to) return "fromUtc must be before toUtc";
        if (to - from > MaxPeriod) return "Period may not exceed 366 days";
        return null;
    }

    static (DateTime From, DateTime To) Period(ReportRequest req, DateTime now)
    {
        var to = req.ToUtc?.ToUniversalTime() ?? now;
        return (req.FromUtc?.ToUniversalTime() ?? to.AddDays(-7), to);
    }

    public async Task<ReportDto> CreateAsync(ReportRequest req, string user, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var (from, to) = Period(req, now);
        var doc = await builder.BuildAsync(req.Type!.Value, from, to, req.MachineId, req.ZoneId, now, ct);
        return await SaveAsync(doc, req.Status, user, JsonSerializer.Serialize(req, Json), ct);
    }

    public async Task<ReportDto> SaveAsync(ReportDocument doc, ReportStatus status, string user, string parametersJson, CancellationToken ct)
    {
        var report = new Report
        {
            Id = Guid.NewGuid(), Type = doc.Type, Status = status, Title = doc.Title, GeneratedUtc = doc.GeneratedUtc, GeneratedBy = user,
            ParametersJson = parametersJson, ContentJson = JsonSerializer.Serialize(doc, Json),
            DataOrigin = DataOrigin.Real, // user-generated record (its content states whether data is synthetic)
        };
        db.Reports.Add(report);
        audit.Add(user, "report.create", report.Id.ToString(), new { doc.Type, status });
        await db.SaveChangesAsync(ct);
        return new ReportDto(report.Id, report.Status, user, doc);
    }

    public Task<List<ReportListItem>> ListAsync(CancellationToken ct) =>
        db.Reports.AsNoTracking().OrderByDescending(r => r.GeneratedUtc).Take(100)
            .Select(r => new ReportListItem(r.Id, r.Type, r.Status, r.Title, r.GeneratedUtc, r.GeneratedBy)).ToListAsync(ct);

    public async Task<ReportDto?> GetAsync(Guid id, CancellationToken ct)
    {
        var r = await db.Reports.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return r is null ? null : new ReportDto(r.Id, r.Status, r.GeneratedBy, JsonSerializer.Deserialize<ReportDocument>(r.ContentJson, Json)!);
    }
}
