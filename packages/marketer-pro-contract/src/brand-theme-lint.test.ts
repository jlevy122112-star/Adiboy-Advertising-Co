import { describe, expect, it } from "vitest";

import {
  BRAND_THEME_WARNING_CODES,
  type BrandTheme,
  type BrandThemeWarningSeverity,
  DEFAULT_BRAND_THEME,
  lintBrandTheme,
} from "./brand-theme.js";

const VALID_SEVERITIES = new Set<BrandThemeWarningSeverity>([
  "error",
  "warning",
  "info",
]);

/** Deep-clone the default theme so each test gets a fresh mutation surface. */
function freshTheme(): BrandTheme {
  return JSON.parse(JSON.stringify(DEFAULT_BRAND_THEME)) as BrandTheme;
}

describe("lintBrandTheme — baseline (DEFAULT_BRAND_THEME)", () => {
  const warnings = lintBrandTheme(DEFAULT_BRAND_THEME);

  it("emits no errors", () => {
    const errors = warnings.filter((w) => w.severity === "error");
    expect(errors).toEqual([]);
  });

  it("emits only the darkPalette info advisory (default uses class strategy)", () => {
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("darkpalette.recommended");
    expect(warnings[0].severity).toBe("info");
  });

  it("every warning uses a published code and a known severity", () => {
    for (const w of warnings) {
      expect(BRAND_THEME_WARNING_CODES).toContain(w.code);
      expect(VALID_SEVERITIES.has(w.severity)).toBe(true);
    }
  });
});

describe("lintBrandTheme — contrast checks", () => {
  it("warns when primary.500 has low contrast against neutral.50", () => {
    const t = freshTheme();
    t.palette.primary["500"] = "#dddddd";
    const warnings = lintBrandTheme(t);
    expect(warnings.some((w) => w.code === "contrast.primary-on-neutral-50")).toBe(
      true,
    );
  });

  it("errors when body text contrast (neutral.900 on neutral.50) fails", () => {
    const t = freshTheme();
    t.palette.neutral["900"] = "#dddddd";
    const warnings = lintBrandTheme(t);
    const found = warnings.find((w) => w.code === "contrast.body-text-on-bg");
    expect(found).toBeDefined();
    expect(found?.severity).toBe("error");
  });

  it("warns when a semantic on-color has insufficient contrast against base", () => {
    const t = freshTheme();
    t.palette.semantic.success.on = t.palette.semantic.success.base;
    const warnings = lintBrandTheme(t);
    expect(
      warnings.some(
        (w) =>
          w.code === "contrast.semantic" &&
          w.field === "palette.semantic.success",
      ),
    ).toBe(true);
  });
});

describe("lintBrandTheme — typography fallback", () => {
  it("warns when fallback chain doesn't end with a generic family", () => {
    const t = freshTheme();
    t.typography.heading.fallback = ["Arial", "Helvetica"];
    const warnings = lintBrandTheme(t);
    const found = warnings.find(
      (w) =>
        w.code === "fallback.no-generic-tail" &&
        w.field === "typography.heading.fallback",
    );
    expect(found).toBeDefined();
  });

  it("does not warn when fallback ends in sans-serif", () => {
    const warnings = lintBrandTheme(DEFAULT_BRAND_THEME);
    expect(warnings.some((w) => w.code === "fallback.no-generic-tail")).toBe(
      false,
    );
  });

  it("does not warn when fallback ends in monospace", () => {
    const t = freshTheme();
    t.typography.body.fallback = ["Helvetica", "monospace"];
    const warnings = lintBrandTheme(t);
    expect(
      warnings.some(
        (w) =>
          w.code === "fallback.no-generic-tail" &&
          w.field === "typography.body.fallback",
      ),
    ).toBe(false);
  });
});

describe("lintBrandTheme — watermark", () => {
  it("warns when an enabled watermark has opacity > 0.7", () => {
    const t = freshTheme();
    t.logos = [
      {
        kind: "primary",
        src: "https://cdn.example.com/logo.svg",
        intrinsicWidth: 256,
        intrinsicHeight: 256,
      },
    ];
    t.watermark = { ...t.watermark, enabled: true, opacity: 0.9 };
    const warnings = lintBrandTheme(t);
    expect(warnings.some((w) => w.code === "watermark.opacity-high")).toBe(
      true,
    );
  });

  it("errors when an enabled watermark refers to a missing logo variant", () => {
    const t = freshTheme();
    t.logos = []; // no variants uploaded
    t.watermark = { ...t.watermark, enabled: true };
    const warnings = lintBrandTheme(t);
    const found = warnings.find((w) => w.code === "watermark.missing-variant");
    expect(found).toBeDefined();
    expect(found?.severity).toBe("error");
  });

  it("does not error when the watermark variant is present", () => {
    const t = freshTheme();
    t.logos = [
      {
        kind: "primary",
        src: "https://cdn.example.com/logo.svg",
        intrinsicWidth: 256,
        intrinsicHeight: 256,
      },
    ];
    t.watermark = { ...t.watermark, enabled: true };
    const warnings = lintBrandTheme(t);
    expect(warnings.some((w) => w.code === "watermark.missing-variant")).toBe(
      false,
    );
  });

  it("emits no watermark warnings when watermark is disabled", () => {
    const warnings = lintBrandTheme(DEFAULT_BRAND_THEME);
    expect(
      warnings.some(
        (w) =>
          w.code === "watermark.opacity-high" ||
          w.code === "watermark.missing-variant",
      ),
    ).toBe(false);
  });
});

describe("lintBrandTheme — voice", () => {
  it("errors when the same phrase appears in both banned and preferred", () => {
    const t = freshTheme();
    t.voice.bannedPhrases = ["foo"];
    t.voice.preferredPhrases = ["foo"];
    const warnings = lintBrandTheme(t);
    const found = warnings.find(
      (w) => w.code === "voice.banned-and-preferred-overlap",
    );
    expect(found).toBeDefined();
    expect(found?.severity).toBe("error");
  });

  it("treats banned/preferred overlap case-insensitively", () => {
    const t = freshTheme();
    t.voice.bannedPhrases = ["Foo"];
    t.voice.preferredPhrases = ["foo"];
    const warnings = lintBrandTheme(t);
    expect(
      warnings.some((w) => w.code === "voice.banned-and-preferred-overlap"),
    ).toBe(true);
  });

  it("emits an info advisory for duplicate banned phrases (case-insensitive)", () => {
    const t = freshTheme();
    t.voice.bannedPhrases = ["foo", "FOO"];
    const warnings = lintBrandTheme(t);
    const dupes = warnings.filter(
      (w) =>
        w.code === "voice.duplicate-phrases" &&
        w.field === "voice.bannedPhrases",
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0].severity).toBe("info");
  });

  it("emits an info advisory for duplicate preferred phrases", () => {
    const t = freshTheme();
    t.voice.preferredPhrases = ["bar", "Bar", "baz"];
    const warnings = lintBrandTheme(t);
    const dupes = warnings.filter(
      (w) =>
        w.code === "voice.duplicate-phrases" &&
        w.field === "voice.preferredPhrases",
    );
    expect(dupes).toHaveLength(1);
  });
});

describe("lintBrandTheme — dark palette advisory", () => {
  it("recommends darkPalette when strategy is class and darkPalette absent", () => {
    const warnings = lintBrandTheme(DEFAULT_BRAND_THEME);
    expect(warnings.some((w) => w.code === "darkpalette.recommended")).toBe(
      true,
    );
  });

  it("does not recommend darkPalette when strategy is off", () => {
    const t = freshTheme();
    t.ui = { ...t.ui, darkModeStrategy: "off" };
    const warnings = lintBrandTheme(t);
    expect(warnings.some((w) => w.code === "darkpalette.recommended")).toBe(
      false,
    );
  });

  it("does not recommend darkPalette when darkPalette is provided", () => {
    const t = freshTheme();
    t.darkPalette = t.palette;
    const warnings = lintBrandTheme(t);
    expect(warnings.some((w) => w.code === "darkpalette.recommended")).toBe(
      false,
    );
  });

  it("recommends darkPalette for media strategy as well", () => {
    const t = freshTheme();
    t.ui = { ...t.ui, darkModeStrategy: "media" };
    const warnings = lintBrandTheme(t);
    expect(warnings.some((w) => w.code === "darkpalette.recommended")).toBe(
      true,
    );
  });
});

describe("lintBrandTheme — overall integrity", () => {
  it("returns warnings whose codes are all in the published code list", () => {
    const t = freshTheme();
    t.palette.primary["500"] = "#dddddd";
    t.voice.bannedPhrases = ["x"];
    t.voice.preferredPhrases = ["x"];
    t.logos = [];
    t.watermark = { ...t.watermark, enabled: true };
    const warnings = lintBrandTheme(t);
    for (const w of warnings) {
      expect(BRAND_THEME_WARNING_CODES).toContain(w.code);
      expect(VALID_SEVERITIES.has(w.severity)).toBe(true);
      expect(w.message.length).toBeGreaterThan(0);
      expect(w.field.length).toBeGreaterThan(0);
    }
  });
});
