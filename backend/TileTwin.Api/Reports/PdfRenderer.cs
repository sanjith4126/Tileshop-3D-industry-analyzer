using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace TileTwin.Api.Reports;

/// <summary>
/// Renders a <see cref="ReportDocument"/> to PDF with QuestPDF.
/// Licence note: QuestPDF Community licence is free only below its revenue threshold; an adopting company must check licensing.
/// </summary>
public static class PdfRenderer
{
    static PdfRenderer() => QuestPDF.Settings.License = LicenseType.Community;

    static string D(DateTime t) => t.ToString("yyyy-MM-dd HH:mm") + " UTC";

    public static byte[] Render(ReportDocument r) => Document.Create(doc => doc.Page(page =>
    {
        page.Size(PageSizes.A4.Landscape());
        page.Margin(28);
        page.DefaultTextStyle(t => t.FontSize(9));

        page.Header().Column(col =>
        {
            if (r.ContainsSyntheticData)
                col.Item().Background(Colors.Amber.Medium).Padding(4).AlignCenter()
                    .Text("SYNTHETIC DATA — TileTwin Demonstration Facility (fictional)").Bold().FontSize(10);
            col.Item().PaddingTop(6).Text(r.Title).Bold().FontSize(18);
            col.Item().Text($"Generated {D(r.GeneratedUtc)} · Period {D(r.FromUtc)} → {D(r.ToUtc)}"
                            + (r.Filters.Count > 0 ? " · Filters: " + string.Join(", ", r.Filters.Select(f => $"{f.Key} = {f.Value}")) : ""))
                .FontColor(Colors.Grey.Darken1);
            col.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
        });

        page.Content().Column(col =>
        {
            col.Spacing(8);
            col.Item().Text("Summary").Bold().FontSize(12);
            foreach (var s in r.Summary) col.Item().Text("• " + s);

            foreach (var section in r.Sections)
            {
                col.Item().PaddingTop(6).Text(section.Heading).Bold().FontSize(12);
                foreach (var p in section.Paragraphs) col.Item().Text(p);
                if (section.Table is { Rows.Count: > 0 } table) col.Item().Element(c => Table(c, table));
            }

            col.Item().PaddingTop(6).Text("Recommendations").Bold().FontSize(12);
            foreach (var rec in r.Recommendations) col.Item().Text("• " + rec);

            col.Item().PaddingTop(10).Text($"Data source: {r.DataSource}").FontColor(Colors.Grey.Darken1);
            if (r.ContainsSyntheticData)
                col.Item().Text("This report is built from SYNTHETIC demonstration data and does not describe a real site.").Italic().FontColor(Colors.Grey.Darken1);
        });

        page.Footer().AlignCenter().Text(t =>
        {
            t.Span("TileTwin AI prototype · page ");
            t.CurrentPageNumber();
            t.Span(" / ");
            t.TotalPages();
        });
    })).GeneratePdf();

    static void Table(IContainer container, ReportTable table) => container.Table(t =>
    {
        t.ColumnsDefinition(c =>
        {
            foreach (var name in table.Columns)
                if (name is "Description" or "Reasons" or "Action" or "Outcome") c.RelativeColumn(3);
                else c.RelativeColumn();
        });
        t.Header(h =>
        {
            foreach (var name in table.Columns)
                h.Cell().Background(Colors.Grey.Lighten3).Padding(3).Text(name).Bold();
        });
        foreach (var row in table.Rows)
            foreach (var cell in row)
                t.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(cell);
    });
}
