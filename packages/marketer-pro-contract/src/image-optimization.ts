/**
 * Image-optimization settings.
 *
 * Defines the per-image render pipeline contract — file format, quality,
 * color profile, responsive variants, and the Core-Web-Vitals-friendly
 * defaults Google Search Console expects from a healthy site.
 *
 * The shape is intentionally exhaustive **and** flat: every field is a
 * primitive or simple enum so the UI can expose a control for each one
 * (the "make all of the settings customizable by the user" requirement
 * from the product spec). Defaults are GSC-friendly out of the box —
 * users tune only what they care about.
 *
 * The settings flow as a three-level override chain:
 *
 *   1. workspace (`ImageOptimizationSettings`) — the user's workspace-wide
 *      defaults.
 *   2. format (`ImageOptimizationOverride`) — adjustments per asset format
 *      (e.g. print formats need 300 DPI + CMYK; social needs sRGB).
 *   3. asset (`ImageOptimizationOverride`) — final per-asset tweaks.
 *
 * Use {@link resolveImageOptimization} to merge them.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                  Enums                                     */
/* -------------------------------------------------------------------------- */

/** File formats we render to. WebP is the default fallback target. */
export const ImageRenderFormatSchema = z.enum([
  "webp",
  "avif",
  "jpg",
  "png",
  "gif",
]);
export type ImageRenderFormat = z.infer<typeof ImageRenderFormatSchema>;

/**
 * Color profile for the rendered output.
 *
 * - `srgb` — universal web default; what GSC expects.
 * - `display_p3` — wide-gamut for high-end displays; falls back to sRGB.
 * - `cmyk` — print pipelines only.
 */
export const ColorProfileSchema = z.enum(["srgb", "display_p3", "cmyk"]);
export type ColorProfile = z.infer<typeof ColorProfileSchema>;

/** Print DPI — only meaningful for print-bound assets. */
export const PrintDpiSchema = z.union([
  z.literal(72),
  z.literal(150),
  z.literal(300),
  z.literal(600),
]);
export type PrintDpi = z.infer<typeof PrintDpiSchema>;

/** `<img loading="…">` HTML attribute hint. */
export const LoadingStrategySchema = z.enum(["auto", "lazy", "eager"]);
export type LoadingStrategy = z.infer<typeof LoadingStrategySchema>;

/** `<img decoding="…">` HTML attribute hint. */
export const DecodingStrategySchema = z.enum(["auto", "async", "sync"]);
export type DecodingStrategy = z.infer<typeof DecodingStrategySchema>;

/* -------------------------------------------------------------------------- */
/*                              Settings schema                               */
/* -------------------------------------------------------------------------- */

/**
 * Frozen-but-not-immutable record of one image-optimization profile. Every
 * field is user-customizable in the settings UI — reasonable defaults are
 * provided in {@link DEFAULT_IMAGE_OPTIMIZATION}.
 */
export const ImageOptimizationSettingsSchema = z
  .object({
    /** Primary output format. WebP is the GSC-recommended default. */
    preferredFormat: ImageRenderFormatSchema,
    /** Fallback for browsers/networks that don't accept the preferred format. */
    fallbackFormat: ImageRenderFormatSchema,
    /**
     * Encode quality 0–100. 85 is the typical sweet spot for WebP/JPG;
     * 0 means lossless when supported.
     */
    quality: z.number().int().min(1).max(100),
    /** Whether to render losslessly when the format supports it (PNG, WebP). */
    lossless: z.boolean(),
    /** Progressive (interlaced) JPEG — improves perceived load time. */
    progressive: z.boolean(),
    /** Strip EXIF / IPTC / XMP from the output (privacy + smaller file). */
    stripMetadata: z.boolean(),
    /** Render color profile. */
    colorProfile: ColorProfileSchema,
    /** Optional cap; the renderer downscales above this. */
    maxWidthPx: z.number().int().positive().max(16384).optional(),
    maxHeightPx: z.number().int().positive().max(16384).optional(),
    /** Optional file-size cap; the renderer drops quality until under this. */
    maxFileBytes: z.number().int().positive().optional(),
    /**
     * Responsive `srcset` widths to render alongside the primary image.
     * Empty array disables srcset generation. Sorted ascending.
     */
    responsiveSrcsetWidths: z
      .array(z.number().int().positive().max(16384))
      .max(12),
    /** Print DPI — only used by print-bound formats. */
    printDpi: PrintDpiSchema,
    /**
     * Whether the renderer must emit explicit `width` + `height` attributes
     * on the `<img>` tag (CLS prevention; required for good Core Web Vitals).
     */
    enforceExplicitDimensions: z.boolean(),
    defaultLoadingStrategy: LoadingStrategySchema,
    defaultDecodingHint: DecodingStrategySchema,
    /**
     * When true, alt text is mandatory on every published image. Disabling
     * is allowed for purely-decorative pipelines but is **not** recommended
     * — Google penalises images without alt in Search results.
     */
    requireAltText: z.boolean(),
    /**
     * When true, the renderer auto-generates a low-quality blurred LQIP
     * (`<img>`'s `style="background-image: url(data:...)"`) for instant
     * paint. Reduces LCP/CLS at the cost of a larger HTML payload.
     */
    generateLqipPlaceholder: z.boolean(),
  })
  .strict();
export type ImageOptimizationSettings = z.infer<
  typeof ImageOptimizationSettingsSchema
>;

/**
 * Partial override applied on top of a base `ImageOptimizationSettings`
 * (formats and per-asset tweaks). All fields optional; missing fields fall
 * through to the base.
 */
export const ImageOptimizationOverrideSchema =
  ImageOptimizationSettingsSchema.partial().strict();
export type ImageOptimizationOverride = z.infer<
  typeof ImageOptimizationOverrideSchema
>;

/* -------------------------------------------------------------------------- */
/*                          GSC-friendly default                              */
/* -------------------------------------------------------------------------- */

/**
 * Shipping defaults — biased toward what Google Search Console rewards:
 * WebP, sRGB, explicit dimensions, lazy loading, alt text required, EXIF
 * stripped, sensible srcset breakpoints. Workspaces start from this.
 */
export const DEFAULT_IMAGE_OPTIMIZATION: ImageOptimizationSettings = {
  preferredFormat: "webp",
  fallbackFormat: "jpg",
  quality: 85,
  lossless: false,
  progressive: true,
  stripMetadata: true,
  colorProfile: "srgb",
  maxWidthPx: 4096,
  maxHeightPx: 4096,
  maxFileBytes: 1_500_000,
  responsiveSrcsetWidths: [320, 640, 768, 1024, 1280, 1920],
  printDpi: 300,
  enforceExplicitDimensions: true,
  defaultLoadingStrategy: "lazy",
  defaultDecodingHint: "async",
  requireAltText: true,
  generateLqipPlaceholder: true,
};

/* -------------------------------------------------------------------------- */
/*                            Override resolution                             */
/* -------------------------------------------------------------------------- */

/** Shallow-merge several optional overrides on top of a base settings record. */
function applyOverrides<T extends object>(
  base: T,
  overrides: ReadonlyArray<Partial<T> | undefined>,
): T {
  let out: T = { ...base };
  for (const ov of overrides) {
    if (!ov) continue;
    out = { ...out, ...ov };
  }
  return out;
}

/**
 * Resolve the effective image-optimization settings for an asset by
 * applying the format-level and asset-level overrides on top of the
 * workspace defaults. Pure; safe to call on every render.
 */
export function resolveImageOptimization(args: {
  readonly workspace: ImageOptimizationSettings;
  readonly format?: ImageOptimizationOverride;
  readonly asset?: ImageOptimizationOverride;
}): ImageOptimizationSettings {
  return applyOverrides(args.workspace, [args.format, args.asset]);
}

/* -------------------------------------------------------------------------- */
/*                          Quality-of-life helpers                           */
/* -------------------------------------------------------------------------- */

/**
 * Clamp / sort the srcset breakpoint list — useful for normalising user
 * input from a free-form text field. Returns a fresh array; does not
 * mutate.
 */
export function normaliseSrcsetWidths(
  widths: ReadonlyArray<number>,
  maxWidthPx?: number,
): number[] {
  const cap = maxWidthPx ?? Number.POSITIVE_INFINITY;
  const out = new Set<number>();
  for (const w of widths) {
    if (!Number.isFinite(w)) continue;
    const i = Math.round(w);
    if (i <= 0) continue;
    out.add(Math.min(i, cap));
  }
  return Array.from(out).sort((a, b) => a - b);
}

/**
 * Suggest a kebab-case filename slug from the user's focus keyword(s).
 * Drops punctuation, collapses whitespace, optionally appends an index
 * (so `1-of-3.webp` etc.).
 */
export function suggestImageFilenameSlug(
  focusKeyword: string,
  index?: number,
  format?: ImageRenderFormat,
): string {
  const base = focusKeyword
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const safeBase = base.length > 0 ? base : "image";
  const indexed = index != null ? `${safeBase}-${index}` : safeBase;
  return format ? `${indexed}.${format}` : indexed;
}

/**
 * Tagged warnings the UI can surface non-blockingly. None of these are
 * hard errors — every setting remains user-customizable per the spec —
 * but each warns the user about a likely SEO / Core-Web-Vitals miss.
 */
export type ImageOptimizationWarning =
  | { code: "lqip_disabled_will_hurt_lcp" }
  | { code: "explicit_dimensions_disabled_will_hurt_cls" }
  | { code: "alt_text_not_required_will_hurt_seo" }
  | { code: "metadata_kept_in_published_files" }
  | { code: "non_srgb_color_profile_for_web"; profile: ColorProfile }
  | { code: "quality_below_recommended_threshold"; quality: number }
  | { code: "srcset_disabled_no_responsive_variants" };

export function lintImageOptimization(
  s: ImageOptimizationSettings,
): ImageOptimizationWarning[] {
  const out: ImageOptimizationWarning[] = [];
  if (!s.generateLqipPlaceholder) {
    out.push({ code: "lqip_disabled_will_hurt_lcp" });
  }
  if (!s.enforceExplicitDimensions) {
    out.push({ code: "explicit_dimensions_disabled_will_hurt_cls" });
  }
  if (!s.requireAltText) {
    out.push({ code: "alt_text_not_required_will_hurt_seo" });
  }
  if (!s.stripMetadata) {
    out.push({ code: "metadata_kept_in_published_files" });
  }
  if (s.colorProfile !== "srgb" && s.colorProfile !== "cmyk") {
    out.push({
      code: "non_srgb_color_profile_for_web",
      profile: s.colorProfile,
    });
  }
  if (s.quality < 70) {
    out.push({ code: "quality_below_recommended_threshold", quality: s.quality });
  }
  if (s.responsiveSrcsetWidths.length === 0) {
    out.push({ code: "srcset_disabled_no_responsive_variants" });
  }
  return out;
}
