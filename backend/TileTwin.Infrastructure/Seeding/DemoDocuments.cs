namespace TileTwin.Infrastructure.Seeding;

/// <summary>Two short fictional procedures so Knowledge Centre search works out of the box (SYNTHETIC).</summary>
public static class DemoDocuments
{
    public static readonly (string Key, string Title, string FileName, string Text)[] All =
    [
        ("press-vibration", "Hydraulic press vibration check (demo procedure)", "press-vibration-check.md", """
            # Hydraulic press vibration check — DEMO PROCEDURE (fictional)

            This procedure is synthetic demonstration content for the TileTwin Demonstration Facility. It is not a real manufacturer procedure.

            ## When to use
            Use when a press shows rising vibration, a vibration threshold alert, or an operator reports knocking during the compaction stroke.

            ## Steps
            1. Isolate the press following the site lock-out procedure before touching any guard.
            2. Check the base frame anchor bolts and the column nuts for looseness; record torque values.
            3. Inspect the guide columns and ram guides for scoring, uneven wear or missing lubrication.
            4. Check the main cylinder seal area for oil leakage and the hydraulic oil temperature trend.
            5. After restart, take a vibration route reading at the crown and base and compare with the baseline.

            ## Escalation
            If vibration remains above the warning limit after the checks, raise a corrective work order and inform the maintenance engineer on shift.
            """),
        ("glaze-safety", "Glaze line safety rules (demo)", "glaze-line-safety.md", """
            # Glaze line safety rules — DEMO (fictional)

            Synthetic demonstration content. Not a real site rule book.

            ## Interlocks
            Spray booth door interlocks must never be bypassed. A bypassed interlock is a critical safety observation and the line must be stopped until it is restored and tested.

            ## Spills and wash-down
            Glaze spills must be cleaned immediately to prevent slips. The wash-water sump level must be checked before every wash-down to avoid overflow.

            ## Inspection cameras
            Inspection camera lenses are cleaned at every shift change. Overspray on the lens can cause false rejects; verify with the reference tile set after cleaning.
            """),
    ];
}
