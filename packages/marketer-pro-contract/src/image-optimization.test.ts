import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_OPTIMIZATION,
  ImageOptimizationOverrideSchema,
  ImageOptimizationSettingsSchema,
  lintImageOptimization,
  normaliseSrcsetWidths,
  resolveImageOptimization,
  suggestImageFilenameSlug,
  type ImageOptimizationSettings,
} from "./image-optimization.js";

describe("DEFAULT_IMAGE_OPTIMIZATION (GSC-friendly defaults)", () => {
  it("parses against the schema", () => {
    expect(
      ImageOptimizationSettingsSchema.safeParse(DEFAULT_IMAGE_OPTIMIZATION)
        .success,
    ).toBe(true);
  });

  it("ships WebP + JPG fallback", () => {
    expect(DEFAULT_IMAGE_OPTIMIZATION.preferredFormat).toBe("webp");
    expect(DEFAULT_IMAGE_OPTIMIZATION.fallbackFormat).toBe("jpg");
  });

  it("ships sRGB color profile (web standard)", () => {
    expect(DEFAULT_IMAGE_OPTIMIZATION.colorProfile).toBe("srgb");
  });

  it("requires alt text and explicit dimensions for CLS / SEO", () => {
    expect(DEFAULT_IMAGE_OPTIMIZATION.requireAltText).toBe(true);
    expect(DEFAULT_IMAGE_OPTIMIZATION.enforceExplicitDimensions).toBe(true);
  });

  it("strips EXIF metadata for privacy + smaller files", () => {
    expect(DEFAULT_IMAGE_OPTIMIZATION.stripMetadata).toBe(true);
  });

  it("ships a sane responsive srcset (mobile → desktop range)", () => {
    expect(DEFAULT_IMAGE_OPTIMIZATION.responsiveSrcsetWidths).toContain(320);
    expect(DEFAULT_IMAGE_OPTIMIZATION.responsiveSrcsetWidths).toContain(1920);
    expect(
      DEFAULT_IMAGE_OPTIMIZATION.responsiveSrcsetWidths.length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("uses lazy loading + async decoding hints by default", () => {
    expect(DEFAULT_IMAGE_OPTIMIZATION.defaultLoadingStrategy).toBe("lazy");
    expect(DEFAULT_IMAGE_OPTIMIZATION.defaultDecodingHint).toBe("async");
  });
});

describe("ImageOptimizationOverrideSchema", () => {
  it("accepts an empty override (no fields changed)", () => {
    expect(ImageOptimizationOverrideSchema.safeParse({}).success).toBe(true);
  });

  it("rejects unknown keys (strict)", () => {
    const r = ImageOptimizationOverrideSchema.safeParse({ unknownKey: 1 });
    expect(r.success).toBe(false);
  });

  it("accepts partial overrides like print pipelines", () => {
    expect(
      ImageOptimizationOverrideSchema.safeParse({
        colorProfile: "cmyk",
        printDpi: 300,
        preferredFormat: "png",
      }).success,
    ).toBe(true);
  });
});

describe("resolveImageOptimization (override chain)", () => {
  it("returns the workspace baseline when no overrides supplied", () => {
    const out = resolveImageOptimization({
      workspace: DEFAULT_IMAGE_OPTIMIZATION,
    });
    expect(out).toEqual(DEFAULT_IMAGE_OPTIMIZATION);
  });

  it("applies the format override on top of the workspace baseline", () => {
    const out = resolveImageOptimization({
      workspace: DEFAULT_IMAGE_OPTIMIZATION,
      format: { colorProfile: "cmyk", printDpi: 300 },
    });
    expect(out.colorProfile).toBe("cmyk");
    expect(out.printDpi).toBe(300);
    expect(out.preferredFormat).toBe(DEFAULT_IMAGE_OPTIMIZATION.preferredFormat);
  });

  it("asset override wins over format override on conflicting keys", () => {
    const out = resolveImageOptimization({
      workspace: DEFAULT_IMAGE_OPTIMIZATION,
      format: { quality: 75, preferredFormat: "jpg" },
      asset: { quality: 95 },
    });
    expect(out.preferredFormat).toBe("jpg");
    expect(out.quality).toBe(95);
  });

  it("does not mutate the workspace baseline object", () => {
    const original: ImageOptimizationSettings = {
      ...DEFAULT_IMAGE_OPTIMIZATION,
      responsiveSrcsetWidths: [...DEFAULT_IMAGE_OPTIMIZATION.responsiveSrcsetWidths],
    };
    resolveImageOptimization({
      workspace: original,
      format: { quality: 50 },
      asset: { lossless: true },
    });
    expect(original).toEqual(DEFAULT_IMAGE_OPTIMIZATION);
  });
});

describe("normaliseSrcsetWidths", () => {
  it("dedupes, sorts, and rounds widths", () => {
    expect(normaliseSrcsetWidths([320, 320.4, 1024, 640])).toEqual([
      320, 640, 1024,
    ]);
  });

  it("drops non-positive and non-finite values", () => {
    expect(normaliseSrcsetWidths([-10, 0, NaN, 800, Infinity])).toEqual([800]);
  });

  it("clamps to maxWidthPx when supplied", () => {
    expect(normaliseSrcsetWidths([320, 1024, 4096], 1024)).toEqual([320, 1024]);
  });
});

describe("suggestImageFilenameSlug", () => {
  it("kebab-cases the focus keyword", () => {
    expect(suggestImageFilenameSlug("Best Hiking Trails 2026")).toBe(
      "best-hiking-trails-2026",
    );
  });

  it("appends an index when supplied", () => {
    expect(suggestImageFilenameSlug("hero shot", 2)).toBe("hero-shot-2");
  });

  it("appends extension when format supplied", () => {
    expect(suggestImageFilenameSlug("hero shot", 1, "webp")).toBe(
      "hero-shot-1.webp",
    );
  });

  it("falls back to 'image' for empty or all-symbol input", () => {
    expect(suggestImageFilenameSlug("")).toBe("image");
    expect(suggestImageFilenameSlug("@#$%")).toBe("image");
  });
});

describe("lintImageOptimization", () => {
  it("returns no warnings for the GSC-friendly default", () => {
    expect(lintImageOptimization(DEFAULT_IMAGE_OPTIMIZATION)).toEqual([]);
  });

  it("warns when explicit dimensions are off (CLS risk)", () => {
    const warnings = lintImageOptimization({
      ...DEFAULT_IMAGE_OPTIMIZATION,
      enforceExplicitDimensions: false,
    });
    expect(
      warnings.find((w) => w.code === "explicit_dimensions_disabled_will_hurt_cls"),
    ).toBeDefined();
  });

  it("warns when alt text isn't required (SEO risk)", () => {
    const warnings = lintImageOptimization({
      ...DEFAULT_IMAGE_OPTIMIZATION,
      requireAltText: false,
    });
    expect(
      warnings.find((w) => w.code === "alt_text_not_required_will_hurt_seo"),
    ).toBeDefined();
  });

  it("warns when quality is below recommended threshold", () => {
    const warnings = lintImageOptimization({
      ...DEFAULT_IMAGE_OPTIMIZATION,
      quality: 50,
    });
    const found = warnings.find(
      (w) => w.code === "quality_below_recommended_threshold",
    );
    expect(found).toBeDefined();
    if (found && found.code === "quality_below_recommended_threshold") {
      expect(found.quality).toBe(50);
    }
  });

  it("warns about a non-sRGB profile for web", () => {
    const warnings = lintImageOptimization({
      ...DEFAULT_IMAGE_OPTIMIZATION,
      colorProfile: "display_p3",
    });
    expect(
      warnings.find((w) => w.code === "non_srgb_color_profile_for_web"),
    ).toBeDefined();
  });

  it("does not warn about CMYK (it's an explicit print signal)", () => {
    const warnings = lintImageOptimization({
      ...DEFAULT_IMAGE_OPTIMIZATION,
      colorProfile: "cmyk",
    });
    expect(
      warnings.find((w) => w.code === "non_srgb_color_profile_for_web"),
    ).toBeUndefined();
  });

  it("warns when srcset is empty (no responsive variants)", () => {
    const warnings = lintImageOptimization({
      ...DEFAULT_IMAGE_OPTIMIZATION,
      responsiveSrcsetWidths: [],
    });
    expect(
      warnings.find((w) => w.code === "srcset_disabled_no_responsive_variants"),
    ).toBeDefined();
  });
});
