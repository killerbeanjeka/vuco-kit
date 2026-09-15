// GENERATED from _bmad-output/planning-artifacts/ux-designs/ux-vuco-2026-07-15/DESIGN.md (frontmatter sha256:8afa19e42908) — DO NOT EDIT.
// Regenerate: node design/tokens/generate-tokens.mjs   (AR-20: hand-copied values are review-rejectable)
// Money-role font per font-verdict.json: Plus Jakarta Sans (tnum confirmed 2026-07-16)

// Included by the document renderer when it lands (Story 5.3) — not compiled before that.
// Typography.Family values are the PER-WEIGHT Skia families (static non-RIBBI weights
// register as their own family — 'Plus Jakarta Sans Medium', not weight 500 of the base).
namespace Vuco.Documents;

public static class VucoDesignTokens
{
    public static class Colors
    {
        public const string SurfaceBase = "#F3F2EF";
        public const string SurfaceRaised = "#FFFFFF";
        public const string SurfaceSunken = "#EAE8E2";
        public const string InkPrimary = "#15181D";
        public const string InkSecondary = "#49515B";
        public const string InkDisabled = "#9AA2AD";
        public const string Primary = "#0E6E63";
        public const string OnPrimary = "#FFFFFF";
        public const string PrimaryTonal = "#E6F4F1";
        public const string OnPrimaryTonal = "#0E6E63";
        public const string Link = "#0E6E63";
        public const string Accent = "#EA580C";
        public const string OnAccent = "#1A1005";
        public const string StatusPaid = "#15803D";
        public const string StatusPaidText = "#166534";
        public const string StatusOverdue = "#D92D20";
        public const string StatusOverdueText = "#B42318";
        public const string StatusFailed = "#B45309";
        public const string StatusFailedText = "#92400E";
        public const string BorderHairline = "#E3E7EC";
        public const string BorderInput = "#6B7280";
        public const string FocusRing = "#0E6E63";
    }

    public static class ColorsDark
    {
        public const string SurfaceBase = "#16171B";
        public const string SurfaceRaised = "#212328";
        public const string SurfaceSunken = "#1B1C21";
        public const string InkPrimary = "#F2F4F7";
        public const string InkSecondary = "#A6ADB8";
        public const string InkDisabled = "#5C636D";
        public const string Primary = "#1F7D72";
        public const string OnPrimary = "#FFFFFF";
        public const string PrimaryTonal = "#16302C";
        public const string OnPrimaryTonal = "#9AD4CA";
        public const string Link = "#9AD4CA";
        public const string Accent = "#FFA35C";
        public const string OnAccent = "#1A1005";
        public const string StatusPaid = "#4ADE80";
        public const string StatusPaidText = "#4ADE80";
        public const string StatusOverdue = "#F97066";
        public const string StatusOverdueText = "#F97066";
        public const string StatusFailed = "#FDB022";
        public const string StatusFailedText = "#FDB022";
        public const string BorderHairline = "#2A2F37";
        public const string BorderInput = "#8A93A0";
        public const string FocusRing = "#3FA294";
    }

    public static class Typography
    {
        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) Display = ("Plus Jakarta Sans ExtraBold", 28f, 800, 1.2f, 0f);
        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) Title = ("Plus Jakarta Sans", 22f, 700, 1.25f, 0f);
        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) Heading = ("Plus Jakarta Sans SemiBold", 17f, 600, 1.3f, 0f);
        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) Body = ("Plus Jakarta Sans", 16f, 400, 1.45f, 0f);
        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) Field = ("Plus Jakarta Sans", 18f, 400, 1.4f, 0f);
        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) Meta = ("Plus Jakarta Sans Medium", 13f, 500, 1.35f, 0f);
        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) Money = ("Plus Jakarta Sans", 20f, 700, 1f, 0f);
        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) MoneyHero = ("Plus Jakarta Sans", 44f, 700, 1.1f, 0f);
    }

    public static class Radii
    {
        public const float Sm = 8f;
        public const float Md = 12f;
        public const float Lg = 16f;
        public const float Xl = 24f;
        public const float Full = 9999f;
    }

    public static class Spacing
    {
        public const float S1 = 4f;
        public const float S2 = 8f;
        public const float S3 = 12f;
        public const float S4 = 16f;
        public const float S5 = 24f;
        public const float S6 = 32f;
        public const float S7 = 48f;
    }

    /// <summary>Money role font family — tnum-verified (AR-24, font-verdict.json).</summary>
    public const string MoneyFontFamily = "Plus Jakarta Sans";

    /// <summary>Money text MUST enable this font feature (tnum is opt-in in QuestPDF).</summary>
    public const string MoneyFontFeature = "tnum";
}
