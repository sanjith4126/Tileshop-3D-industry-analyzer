using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Xunit.Abstractions;

namespace TileTwin.Architecture.Tests;

/// <summary>
/// Layer rules from docs/MASTER_PROMPT.md §5.1, checked with plain reflection and a source scan (ADR 0016).
/// Report-only until Phase 7: violations are written to the test output and to
/// TestResults/architecture-report.txt; set ARCH_TESTS_BLOCKING=true to make them fail.
/// </summary>
public partial class LayerRuleTests(ITestOutputHelper output)
{
    static readonly bool Blocking = string.Equals(Environment.GetEnvironmentVariable("ARCH_TESTS_BLOCKING"), "true", StringComparison.OrdinalIgnoreCase);
    static readonly Assembly Api = typeof(Program).Assembly;

    static Assembly? Load(string name)
    {
        try { return Assembly.Load(name); }
        catch (FileNotFoundException) { return null; }
    }

    static IEnumerable<string> References(Assembly a) => a.GetReferencedAssemblies().Select(r => r.Name!);

    static readonly object Gate = new();
    static bool started;

    void Report(string rule, IReadOnlyCollection<string> violations)
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "TestResults");
        var file = Path.Combine(dir, "architecture-report.txt");
        var lines = violations.Count == 0 ? [$"PASS  {rule}"] : violations.Select(v => $"FAIL  {rule}: {v}").ToList();
        lock (Gate)
        {
            Directory.CreateDirectory(dir);
            if (!started) { File.Delete(file); started = true; }
            File.AppendAllLines(file, lines);
        }
        foreach (var l in lines) output.WriteLine(l);
        if (Blocking) Assert.Empty(violations);
    }

    [Fact]
    public void Domain_references_nothing_but_the_base_library()
    {
        var domain = Load("TileTwin.Domain")!;
        Report("Domain references only System.*", References(domain)
            .Where(n => !(n.StartsWith("System") || n is "netstandard" or "mscorlib")).ToList());
    }

    [Fact]
    public void Application_layer_exists_and_references_only_Domain()
    {
        var app = Load("TileTwin.Application");
        if (app is null)
        {
            Report("Application layer exists", ["assembly TileTwin.Application not found"]);
            return;
        }
        Report("Application references only Domain among TileTwin projects", References(app)
            .Where(n => n.StartsWith("TileTwin.") && n != "TileTwin.Domain").ToList());
    }

    [Fact]
    public void Infrastructure_does_not_reference_hosts()
    {
        var infra = Load("TileTwin.Infrastructure")!;
        Report("Infrastructure does not reference API, Worker or Cli", References(infra)
            .Where(n => n is "TileTwin.Api" or "TileTwin.Worker" or "TileTwin.Cli").ToList());
    }

    [Fact]
    public void Controllers_do_not_use_the_database_directly()
    {
        var offenders = Api.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .SelectMany(t => t.GetConstructors().SelectMany(c => c.GetParameters())
                .Where(p => p.ParameterType.Name.Contains("DbContext"))
                .Select(p => $"{t.Name}({p.ParameterType.Name})"))
            .ToList();
        Report("Controllers take use cases, not a DbContext", offenders);
    }

    [GeneratedRegex(@"DateTime(Offset)?\.(Utc)?Now\b")]
    private static partial Regex WallClock();

    [Fact]
    public void Business_code_reads_time_from_TimeProvider()
    {
        var root = FindBackendRoot();
        var offenders = Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")
                        && !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
                        && !f.Contains("Tests") && !f.Contains($"{Path.DirectorySeparatorChar}Migrations{Path.DirectorySeparatorChar}"))
            .SelectMany(f => File.ReadLines(f).Select((line, i) => (f, line, i)))
            .Where(x => WallClock().IsMatch(x.line) && !x.line.TrimStart().StartsWith("//"))
            .Select(x => $"{Path.GetRelativePath(root, x.f)}:{x.i + 1}")
            .ToList();
        Report("No DateTime.UtcNow / DateTime.Now outside tests", offenders);
    }

    static string FindBackendRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "TileTwin.slnx"))) dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("backend/TileTwin.slnx not found");
    }
}
