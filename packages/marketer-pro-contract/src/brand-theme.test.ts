import { describe, expect, it } from "vitest";

import {
  BRAND_FORMALITIES,
  BRAND_READING_LEVELS,
  BrandPaletteSchema,
  BrandThemeOverrideSchema,
  BrandThemeSchema,
  BrandTypographySchema,
  BrandUiPrefsSchema,
  BrandVoiceSchema,
  DARK_MODE_STRATEGIES,
  DEFAULT_BRAND_THEME,
  DENSITIES,
  FontFamilySchema,
  LOGO_VARIANT_KINDS,
  LogoSafeZoneSchema,
  LogoVariantKindSchema,
  LogoVariantSchema,
  MOTION_PREFERENCES,
  SemanticColorSchema,
  SemanticPaletteSchema,
  WATERMARK_MEDIUMS,
  WATERMARK_POSITIONS,
  WatermarkPolicySchema,
} from "./brand-theme.js";
import { contrastRatio, WCAG_AA_NORMAL } from "./brand-theme-tokens.js";

describe("DEFAULT_BRAND_THEME", () => {
  it("parses cleanly via BrandThemeSchema", () => {
    expect(() => BrandThemeSchema.parse(DEFAULT_BRAND_THEME)).not.toThrow();
  });

  it("has the expected top-level identity", () => {
    expect(DEFAULT_BRAND_THEME.id).toBe("default");
    expect(DEFAULT_BRAND_THEME.name).toBe("Default");
    expect(DEFAULT_BRAND_THEME.version).toBe(1);
  });

  it("starts with no logos so tenants must opt in", () => {
    expect(DEFAULT_BRAND_THEME.logos).toEqual([]);
  });

  it("disables watermark by default", () => {
    expect(DEFAULT_BRAND_THEME.watermark.enabled).toBe(false);
  });

  it("uses class-based dark mode strategy by default", () => {
    expect(DEFAULT_BRAND_THEME.ui.darkModeStrategy).toBe("class");
  });

  it("ships every semantic on-color passing WCAG AA Normal vs its base", () => {
    const semantics = DEFAULT_BRAND_THEME.palette.semantic;
    for (const key of ["success", "warning", "danger", "info"] as const) {
      const ratio = contrastRatio(semantics[key].on, semantics[key].base);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    }
  });

  it("primary scale has all 11 steps", () => {
    expect(Object.keys(DEFAULT_BRAND_THEME.palette.primary)).toHaveLength(11);
  });

  it("ships system-font fallback ending in sans-serif", () => {
    const headingFallback = DEFAULT_BRAND_THEME.typography.heading.fallback;
    expect(headingFallback[headingFallback.length - 1]).toBe("sans-serif");
  });

  it("ships mono fallback ending in monospace", () => {
    const monoFallback = DEFAULT_BRAND_THEME.typography.mono.fallback;
    expect(monoFallback[monoFallback.length - 1]).toBe("monospace");
  });
});

describe("LogoVariantKindSchema", () => {
  it("accepts every documented kind", () => {
    for (const kind of LOGO_VARIANT_KINDS) {
      expect(LogoVariantKindSchema.parse(kind)).toBe(kind);
    }
  });

  it("rejects unknown kinds", () => {
    expect(LogoVariantKindSchema.safeParse("hero").success).toBe(false);
  });
});

describe("LogoSafeZoneSchema", () => {
  it("accepts non-negative integer insets", () => {
    expect(() =>
      LogoSafeZoneSchema.parse({ top: 0, right: 8, bottom: 8, left: 0 }),
    ).not.toThrow();
  });

  it("rejects negative insets", () => {
    expect(
      LogoSafeZoneSchema.safeParse({
        top: -1,
        right: 0,
        bottom: 0,
        left: 0,
      }).success,
    ).toBe(false);
  });
});

describe("LogoVariantSchema", () => {
  const goodVariant = {
    kind: "primary" as const,
    src: "https://cdn.example.com/logo.svg",
    intrinsicWidth: 512,
    intrinsicHeight: 128,
  };

  it("accepts a minimal valid variant", () => {
    expect(() => LogoVariantSchema.parse(goodVariant)).not.toThrow();
  });

  it("rejects empty src", () => {
    expect(
      LogoVariantSchema.safeParse({ ...goodVariant, src: "" }).success,
    ).toBe(false);
  });

  it("rejects zero or negative dimensions", () => {
    expect(
      LogoVariantSchema.safeParse({ ...goodVariant, intrinsicWidth: 0 })
        .success,
    ).toBe(false);
    expect(
      LogoVariantSchema.safeParse({ ...goodVariant, intrinsicHeight: -10 })
        .success,
    ).toBe(false);
  });
});

describe("SemanticColorSchema", () => {
  it("requires both base and on", () => {
    expect(() =>
      SemanticColorSchema.parse({ base: "#ff0000", on: "#ffffff" }),
    ).not.toThrow();
    expect(SemanticColorSchema.safeParse({ base: "#ff0000" }).success).toBe(
      false,
    );
  });
});

describe("SemanticPaletteSchema", () => {
  it("requires all 4 semantic slots", () => {
    const partial = {
      success: { base: "#000000", on: "#ffffff" },
      warning: { base: "#000000", on: "#ffffff" },
    };
    expect(SemanticPaletteSchema.safeParse(partial).success).toBe(false);
  });
});

describe("BrandPaletteSchema", () => {
  it("DEFAULT_BRAND_THEME palette parses", () => {
    expect(() =>
      BrandPaletteSchema.parse(DEFAULT_BRAND_THEME.palette),
    ).not.toThrow();
  });

  it("rejects palette missing a scale", () => {
    const { secondary: _omit, ...rest } = DEFAULT_BRAND_THEME.palette;
    expect(BrandPaletteSchema.safeParse(rest).success).toBe(false);
  });
});

describe("FontFamilySchema", () => {
  const goodFont = {
    family: "Inter",
    fallback: ["system-ui", "sans-serif"],
    weights: ["400", "600"],
  };

  it("accepts a valid family", () => {
    expect(() => FontFamilySchema.parse(goodFont)).not.toThrow();
  });

  it("requires at least one fallback", () => {
    expect(
      FontFamilySchema.safeParse({ ...goodFont, fallback: [] }).success,
    ).toBe(false);
  });

  it("rejects weights outside the 100..900 hundreds range", () => {
    expect(
      FontFamilySchema.safeParse({ ...goodFont, weights: ["1000"] }).success,
    ).toBe(false);
    expect(
      FontFamilySchema.safeParse({ ...goodFont, weights: ["regular"] }).success,
    ).toBe(false);
    expect(
      FontFamilySchema.safeParse({ ...goodFont, weights: [] }).success,
    ).toBe(false);
  });
});

describe("BrandTypographySchema", () => {
  it("DEFAULT_BRAND_THEME typography parses", () => {
    expect(() =>
      BrandTypographySchema.parse(DEFAULT_BRAND_THEME.typography),
    ).not.toThrow();
  });
});

describe("BrandVoiceSchema", () => {
  it("accepts a minimal valid voice", () => {
    expect(() =>
      BrandVoiceSchema.parse({
        formality: "neutral",
        persona: "Friendly",
        bannedPhrases: [],
        preferredPhrases: [],
        readingLevel: "college",
      }),
    ).not.toThrow();
  });

  it("ships every advertised formality", () => {
    expect(BRAND_FORMALITIES).toHaveLength(4);
    for (const f of BRAND_FORMALITIES) {
      expect(() =>
        BrandVoiceSchema.parse({
          formality: f,
          persona: "p",
          bannedPhrases: [],
          preferredPhrases: [],
          readingLevel: "high_school",
        }),
      ).not.toThrow();
    }
  });

  it("ships every advertised reading level", () => {
    expect(BRAND_READING_LEVELS).toHaveLength(5);
    for (const r of BRAND_READING_LEVELS) {
      expect(() =>
        BrandVoiceSchema.parse({
          formality: "neutral",
          persona: "p",
          bannedPhrases: [],
          preferredPhrases: [],
          readingLevel: r,
        }),
      ).not.toThrow();
    }
  });
});

describe("BrandUiPrefsSchema", () => {
  it("DEFAULT_BRAND_THEME ui prefs parse", () => {
    expect(() =>
      BrandUiPrefsSchema.parse(DEFAULT_BRAND_THEME.ui),
    ).not.toThrow();
  });

  it("ships every density, motion preference, and dark-mode strategy", () => {
    expect(DENSITIES).toHaveLength(3);
    expect(MOTION_PREFERENCES).toHaveLength(3);
    expect(DARK_MODE_STRATEGIES).toHaveLength(4);
  });
});

describe("WatermarkPolicySchema", () => {
  const goodPolicy = {
    enabled: true,
    logoVariantKind: "primary" as const,
    position: "bottom-right" as const,
    opacity: 0.5,
    scalePct: 10,
    mediums: ["image"] as const,
  };

  it("accepts a typical policy", () => {
    expect(() => WatermarkPolicySchema.parse(goodPolicy)).not.toThrow();
  });

  it("rejects opacity outside [0,1]", () => {
    expect(
      WatermarkPolicySchema.safeParse({ ...goodPolicy, opacity: 1.5 }).success,
    ).toBe(false);
    expect(
      WatermarkPolicySchema.safeParse({ ...goodPolicy, opacity: -0.1 }).success,
    ).toBe(false);
  });

  it("rejects scalePct outside [1,100]", () => {
    expect(
      WatermarkPolicySchema.safeParse({ ...goodPolicy, scalePct: 0 }).success,
    ).toBe(false);
    expect(
      WatermarkPolicySchema.safeParse({ ...goodPolicy, scalePct: 101 }).success,
    ).toBe(false);
  });

  it("ships every advertised position (9-pt grid) and medium", () => {
    expect(WATERMARK_POSITIONS).toHaveLength(9);
    expect(WATERMARK_MEDIUMS).toEqual(["image", "video"]);
  });

  it("allows empty mediums (effectively disables watermark)", () => {
    expect(() =>
      WatermarkPolicySchema.parse({ ...goodPolicy, mediums: [] }),
    ).not.toThrow();
  });
});

describe("BrandThemeSchema", () => {
  it("rejects unknown top-level keys (strict)", () => {
    expect(
      BrandThemeSchema.safeParse({
        ...DEFAULT_BRAND_THEME,
        nonsense: true,
      }).success,
    ).toBe(false);
  });

  it("requires version >= 1", () => {
    expect(
      BrandThemeSchema.safeParse({ ...DEFAULT_BRAND_THEME, version: 0 })
        .success,
    ).toBe(false);
  });
});

describe("BrandThemeOverrideSchema", () => {
  it("accepts an empty override", () => {
    expect(() => BrandThemeOverrideSchema.parse({})).not.toThrow();
  });

  it("accepts a partial palette override (no other fields required)", () => {
    expect(() =>
      BrandThemeOverrideSchema.parse({
        palette: { primary: DEFAULT_BRAND_THEME.palette.primary },
      }),
    ).not.toThrow();
  });

  it("accepts a partial voice override", () => {
    expect(() =>
      BrandThemeOverrideSchema.parse({
        voice: { formality: "playful" },
      }),
    ).not.toThrow();
  });

  it("rejects unknown top-level keys (strict)", () => {
    expect(
      BrandThemeOverrideSchema.safeParse({
        unknownField: "x",
      }).success,
    ).toBe(false);
  });
});
