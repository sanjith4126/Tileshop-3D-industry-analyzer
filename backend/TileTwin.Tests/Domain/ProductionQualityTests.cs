using TileTwin.Domain.Production;

namespace TileTwin.Tests.Domain;

public class ProductionQualityTests
{
    [Theory]
    [InlineData(1000, 25, 2.5)]
    [InlineData(3, 1, 33.33)]
    [InlineData(500, 0, 0.0)]
    public void Reject_rate_is_rejected_over_produced(int produced, int rejected, double expected) =>
        Assert.Equal(expected, ProductionQuality.RejectRatePercent(produced, rejected));

    [Fact]
    public void No_production_gives_no_rate_rather_than_zero() => Assert.Null(ProductionQuality.RejectRatePercent(0, 0));
}
