import { describe, expect, it } from "vitest";

import {
  brandingToTheme,
  BrandThemeSchema,
  DEFAULT_BRAND_THEME,
  resolveBrandTheme,
  themeToCssVariables,
  themeToTokensJson,
  tintScaleFromHex,
} from "./brand-theme.js";
import {
  COLOR_SCALE_STEPS,
  HexColorSchema,
} from "./brand-theme-tokens.js";

/* ---------- resolveBrandTheme ---------------------------------------------- */

describe("resolveBrandTheme", () => {
  it("returns workspace unchanged when no overrides are supplied", () => {
    const out = resolveBrandTheme({ workspace: DEFAULT_BRAND_THEME });
    expect(out).toEqual(DEFAULT_BRAND_THEME);
  });

  it("applies a top-level name override", () => {
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      format: { name: "Print" },
    });
    expect(out.name).toBe("Print");
    expect(out.palette).toEqual(DEFAULT_BRAND_THEME.palette);
  });

  it("nested palette overrides only replace the specified slice", () => {
    const customPrimary = tintScaleFromHex("#ff5500");
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      format: { palette: { primary: customPrimary } },
    });
    expect(out.palette.primary).toEqual(customPrimary);
    expect(out.palette.secondary).toEqual(DEFAULT_BRAND_THEME.palette.secondary);
    expect(out.palette.semantic).toEqual(DEFAULT_BRAND_THEME.palette.semantic);
  });

  it("nested voice overrides only replace specified keys", () => {
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      format: { voice: { formality: "playful" } },
    });
    expect(out.voice.formality).toBe("playful");
    expect(out.voice.persona).toBe(DEFAULT_BRAND_THEME.voice.persona);
    expect(out.voice.readingLevel).toBe(DEFAULT_BRAND_THEME.voice.readingLevel);
  });

  it("watermark partial enables without losing other settings", () => {
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      format: { watermark: { enabled: true } },
    });
    expect(out.watermark.enabled).toBe(true);
    expect(out.watermark.position).toBe(DEFAULT_BRAND_THEME.watermark.position);
    expect(out.watermark.scalePct).toBe(DEFAULT_BRAND_THEME.watermark.scalePct);
  });

  it("asset overrides beat format overrides", () => {
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      format: { name: "Format Name" },
      asset: { name: "Asset Name" },
    });
    expect(out.name).toBe("Asset Name");
  });

  it("format applies when asset doesn't touch a field", () => {
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      format: { name: "Format Name" },
      asset: { voice: { formality: "casual" } },
    });
    expect(out.name).toBe("Format Name");
    expect(out.voice.formality).toBe("casual");
  });

  it("logos array is fully replaced when overridden", () => {
    const newLogo = {
      kind: "primary" as const,
      src: "https://cdn.example.com/x.svg",
      intrinsicWidth: 256,
      intrinsicHeight: 256,
    };
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      asset: { logos: [newLogo] },
    });
    expect(out.logos).toEqual([newLogo]);
  });

  it("undefined override fields don't erase workspace fields", () => {
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      format: { name: undefined, voice: { formality: undefined } },
    });
    expect(out.name).toBe(DEFAULT_BRAND_THEME.name);
    expect(out.voice.formality).toBe(DEFAULT_BRAND_THEME.voice.formality);
  });

  it("resolved theme always passes BrandThemeSchema", () => {
    const out = resolveBrandTheme({
      workspace: DEFAULT_BRAND_THEME,
      format: { palette: { primary: tintScaleFromHex("#bada55") } },
      asset: { voice: { formality: "playful" } },
    });
    expect(() => BrandThemeSchema.parse(out)).not.toThrow();
  });
});

/* ---------- themeToCssVariables -------------------------------------------- */

describe("themeToCssVariables", () => {
  const vars = themeToCssVariables(DEFAULT_BRAND_THEME);

  it("emits a property per scale step for every palette role", () => {
    for (const role of ["primary", "secondary", "accent", "neutral"]) {
      for (const step of COLOR_SCALE_STEPS) {
        expect(vars).toHaveProperty(`brand-${role}-${step}`);
      }
    }
  });

  it("emits semantic base + on for every semantic key", () => {
    for (const key of ["success", "warning", "danger", "info"]) {
      expect(vars[`brand-semantic-${key}-base`]).toBeDefined();
      expect(vars[`brand-semantic-${key}-on`]).toBeDefined();
    }
  });

  it("emits font-family values that quote the primary family and join fallbacks with ', '", () => {
    expect(vars["brand-font-heading"]).toContain('"Inter"');
    expect(vars["brand-font-heading"]).toContain(", system-ui");
    expect(vars["brand-font-heading"]).toContain(", sans-serif");
    expect(vars["brand-font-mono"]).toContain('"JetBrains Mono"');
  });

  it("emits a font size for every type-scale step", () => {
    for (const step of ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"]) {
      expect(vars[`brand-font-size-${step}`]).toBeDefined();
    }
  });

  it("emits a font weight for every weight key", () => {
    for (const key of ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"]) {
      expect(vars[`brand-font-weight-${key}`]).toBeDefined();
    }
  });

  it("emits a radius and shadow and motion variable per scale step", () => {
    for (const r of ["none", "sm", "md", "lg", "xl", "2xl", "full"]) {
      expect(vars[`brand-radius-${r}`]).toBeDefined();
    }
    for (const s of ["0", "1", "2", "3", "4", "5"]) {
      expect(vars[`brand-shadow-${s}`]).toBeDefined();
    }
    for (const m of ["instant", "fast", "normal", "slow", "slowest"]) {
      expect(vars[`brand-motion-${m}`]).toBeDefined();
    }
  });

  it("emits a baseline-grid variable in px", () => {
    expect(vars["brand-baseline-grid"]).toMatch(/\d+px$/);
  });

  it("respects a custom prefix", () => {
    const tenant = themeToCssVariables(DEFAULT_BRAND_THEME, { prefix: "acme-" });
    expect(tenant).toHaveProperty("acme-primary-500");
    expect(tenant).not.toHaveProperty("brand-primary-500");
  });

  it("output is byte-stable for the same input (deterministic insertion order)", () => {
    const a = JSON.stringify(themeToCssVariables(DEFAULT_BRAND_THEME));
    const b = JSON.stringify(themeToCssVariables(DEFAULT_BRAND_THEME));
    expect(a).toBe(b);
  });

  it("resolves the actual values from the theme (sanity check)", () => {
    expect(vars["brand-primary-500"]).toBe(DEFAULT_BRAND_THEME.palette.primary["500"]);
    expect(vars["brand-semantic-danger-on"]).toBe(DEFAULT_BRAND_THEME.palette.semantic.danger.on);
  });
});

/* ---------- themeToTokensJson ---------------------------------------------- */

describe("themeToTokensJson", () => {
  const tokens = themeToTokensJson(DEFAULT_BRAND_THEME);

  it("uses dotted keys", () => {
    expect(tokens["brand.primary.500"]).toBeDefined();
    expect(tokens["brand.semantic.success.base"]).toBeDefined();
    expect(tokens["brand.size.base"]).toBeDefined();
  });

  it("keys are sorted alphabetically (byte-stable JSON.stringify)", () => {
    const keys = Object.keys(tokens);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it("matches the value from the theme for known tokens", () => {
    expect(tokens["brand.primary.500"]).toBe(DEFAULT_BRAND_THEME.palette.primary["500"]);
    expect(tokens["brand.typography.heading.family"]).toBe(DEFAULT_BRAND_THEME.typography.heading.family);
  });

  it("output is byte-stable", () => {
    expect(JSON.stringify(themeToTokensJson(DEFAULT_BRAND_THEME))).toBe(
      JSON.stringify(themeToTokensJson(DEFAULT_BRAND_THEME)),
    );
  });
});

/* ---------- tintScaleFromHex ----------------------------------------------- */

describe("tintScaleFromHex", () => {
  it("places the input at step 500", () => {
    const scale = tintScaleFromHex("#1d4ed8");
    expect(scale["500"]).toBe("#1d4ed8");
  });

  it("returns a complete 11-step scale of valid hex values", () => {
    const scale = tintScaleFromHex("#ff5500");
    expect(Object.keys(scale)).toHaveLength(11);
    for (const step of COLOR_SCALE_STEPS) {
      expect(HexColorSchema.parse(scale[step])).toBeDefined();
    }
  });

  it("step 50 is brighter (closer to white) than the base", () => {
    const scale = tintScaleFromHex("#1d4ed8");
    const r50 = parseInt(scale["50"].slice(1, 3), 16);
    const rBase = parseInt(scale["500"].slice(1, 3), 16);
    expect(r50).toBeGreaterThan(rBase);
  });

  it("step 950 is darker (closer to black) than the base", () => {
    const scale = tintScaleFromHex("#1d4ed8");
    const r950 = parseInt(scale["950"].slice(1, 3), 16);
    const rBase = parseInt(scale["500"].slice(1, 3), 16);
    expect(r950).toBeLessThanOrEqual(rBase);
  });
});

/* ---------- brandingToTheme ------------------------------------------------ */

describe("brandingToTheme", () => {
  it("returns a theme that passes BrandThemeSchema for an empty branding", () => {
    const theme = brandingToTheme({});
    expect(() => BrandThemeSchema.parse(theme)).not.toThrow();
    expect(theme.name).toBe("Custom");
    expect(theme.id).toBe("from-branding");
    expect(theme.logos).toEqual([]);
  });

  it("uses displayName when provided", () => {
    const theme = brandingToTheme({ displayName: "Acme Co" });
    expect(theme.name).toBe("Acme Co");
  });

  it("creates a primary logo variant when logoUrl is set", () => {
    const theme = brandingToTheme({
      logoUrl: "https://cdn.example.com/logo.svg",
      displayName: "Acme",
    });
    expect(theme.logos).toHaveLength(1);
    expect(theme.logos[0].kind).toBe("primary");
    expect(theme.logos[0].src).toBe("https://cdn.example.com/logo.svg");
    expect(theme.logos[0].usageHint).toBe("Primary logo for Acme");
  });

  it("respects the logoIntrinsic option for generated logo dimensions", () => {
    const theme = brandingToTheme(
      { logoUrl: "https://cdn.example.com/logo.svg" },
      { logoIntrinsic: { width: 512, height: 256 } },
    );
    expect(theme.logos[0].intrinsicWidth).toBe(512);
    expect(theme.logos[0].intrinsicHeight).toBe(256);
  });

  it("anchors the primary scale on primaryHex when provided", () => {
    const theme = brandingToTheme({ primaryHex: "#ff5500" });
    expect(theme.palette.primary["500"]).toBe("#ff5500");
    // Other scales remain default.
    expect(theme.palette.secondary).toEqual(DEFAULT_BRAND_THEME.palette.secondary);
  });

  it("anchors the accent scale on accentHex when provided", () => {
    const theme = brandingToTheme({ accentHex: "#00ccff" });
    expect(theme.palette.accent["500"]).toBe("#00ccff");
  });

  it("respects an explicit id override", () => {
    const theme = brandingToTheme({}, { id: "tenant-123" });
    expect(theme.id).toBe("tenant-123");
  });
});
