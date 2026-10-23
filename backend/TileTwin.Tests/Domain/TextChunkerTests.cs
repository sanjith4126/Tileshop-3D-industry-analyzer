using TileTwin.Domain.Knowledge;

namespace TileTwin.Tests.Domain;

public class TextChunkerTests
{
    [Fact]
    public void Short_paragraphs_are_grouped_up_to_the_limit()
    {
        var chunks = TextChunker.Chunk("aaa\n\nbbb\n\n\nccc", maxChars: 9);
        Assert.Equal(["aaa\n\nbbb", "ccc"], chunks);
    }

    [Fact]
    public void Long_paragraph_is_split_at_word_boundaries_without_losing_words()
    {
        var words = Enumerable.Range(0, 300).Select(i => $"w{i}").ToList();
        var chunks = TextChunker.Chunk(string.Join(' ', words), maxChars: 100);
        Assert.All(chunks, c => Assert.True(c.Length <= 100));
        Assert.Equal(words, chunks.SelectMany(c => c.Split(' ')));
    }

    [Fact]
    public void Blank_text_gives_no_chunks_and_windows_newlines_are_handled()
    {
        Assert.Empty(TextChunker.Chunk("  \n\n \r\n "));
        Assert.Equal(["a", "b"], TextChunker.Chunk("a\r\n\r\nb", maxChars: 2));
    }
}
