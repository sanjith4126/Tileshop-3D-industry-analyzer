using System.Text;
using System.Text.RegularExpressions;

namespace TileTwin.Domain.Knowledge;

/// <summary>Splits text into chunks of whole paragraphs up to <see cref="MaxChars"/>; over-long paragraphs split at word boundaries.</summary>
public static partial class TextChunker
{
    public const int MaxChars = 1000;

    [GeneratedRegex(@"\n\s*\n")]
    private static partial Regex ParagraphBreak();

    // ponytail: no overlap between chunks; add a sentence of overlap if answers start missing context at chunk edges.
    public static List<string> Chunk(string text, int maxChars = MaxChars)
    {
        var chunks = new List<string>();
        var current = new StringBuilder();
        void Flush()
        {
            if (current.Length > 0) chunks.Add(current.ToString().Trim());
            current.Clear();
        }

        foreach (var raw in ParagraphBreak().Split(text.Replace("\r\n", "\n")))
        {
            var para = Regex.Replace(raw.Trim(), @"[ \t]+", " ");
            if (para.Length == 0) continue;
            if (para.Length > maxChars)
            {
                Flush();
                foreach (var piece in SplitLong(para, maxChars)) chunks.Add(piece);
                continue;
            }
            if (current.Length + para.Length + 2 > maxChars) Flush();
            if (current.Length > 0) current.Append("\n\n");
            current.Append(para);
        }
        Flush();
        return chunks;
    }

    static IEnumerable<string> SplitLong(string para, int maxChars)
    {
        var sb = new StringBuilder();
        foreach (var word in para.Split(' '))
        {
            if (sb.Length + word.Length + 1 > maxChars && sb.Length > 0)
            {
                yield return sb.ToString();
                sb.Clear();
            }
            if (sb.Length > 0) sb.Append(' ');
            sb.Append(word.Length > maxChars ? word[..maxChars] : word);
        }
        if (sb.Length > 0) yield return sb.ToString();
    }
}
