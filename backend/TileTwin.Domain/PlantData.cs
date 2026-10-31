namespace TileTwin.Domain;

/// <summary>
/// Data classification (master prompt sections 2 and 6). It is set at plant level and every record under the plant
/// inherits it. The only plant is the fictional demonstration plant, seeded as synthetic, so all plant data is
/// SYNTHETIC — including records users create there, whose DataOrigin is Real only so "Reset demo data" keeps them.
/// </summary>
public static class PlantData
{
    public const string Classification = "SYNTHETIC";
}
