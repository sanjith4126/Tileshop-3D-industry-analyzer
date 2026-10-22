namespace TileTwin.Api.Configuration;

/// <summary>
/// Loads the repo-root .env into process environment variables (existing variables win).
/// Searches upward from the working directory so `dotnet run` and `dotnet test` both find it.
/// </summary>
public static class EnvFile
{
    public static string? Load()
    {
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        for (var i = 0; dir is not null && i < 8; i++, dir = dir.Parent)
        {
            var path = Path.Combine(dir.FullName, ".env");
            if (!File.Exists(path)) continue;

            foreach (var raw in File.ReadAllLines(path))
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith('#')) continue;
                var eq = line.IndexOf('=');
                if (eq <= 0) continue;

                var key = line[..eq].Trim();
                var value = StripComment(line[(eq + 1)..]).Trim().Trim('"');
                if (Environment.GetEnvironmentVariable(key) is null)
                    Environment.SetEnvironmentVariable(key, value);
            }
            return path;
        }
        return null;
    }

    static string StripComment(string value)
    {
        var trimmed = value.TrimStart();
        if (trimmed.StartsWith('#')) return "";
        var hash = value.IndexOf(" #", StringComparison.Ordinal);
        return hash >= 0 ? value[..hash] : value;
    }
}
