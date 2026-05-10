import { z } from "zod";

import {
  type ColorScale,
  ColorScaleSchema,
  contrastRatio,
  HexColorSchema,
  MotionDurationScaleSchema,
  normaliseHex,
  RadiusScaleSchema,
  ShadowScaleSchema,
  TypeScaleSchema,
  WCAG_AA_NORMAL,
  WeightScaleSchema,
} from "./brand-theme-tokens.js";

/**
 * White-label rendering theme. Layered on top of the thinner persistence
 * shape `WorkspaceBrandingSchema` (which lives in index.ts and is what
 * actually gets stored on `workspaces.branding_json`). Use `brandingToTheme`
 * (CP-1.C.3) to derive a fully-populated theme from a stored branding row.
 */

/* ---------------------------------------------------------------------------
 * Logo variants
 * ------------------------------------------------------------------------- */

export const LOGO_VARIANT_KINDS = [
  "primary",
  "dark",
  "light",
  "icon",
  "monochrome",
  "favicon",
] as const;
export type LogoVariantKind = (typeof LOGO_VARIANT_KINDS)[number];

export const LogoVariantKindSchema = z.enum(LOGO_VARIANT_KINDS);

export const LogoSafeZoneSchema = z
  .object({
    top: z.number().int().min(0).max(2048),
    right: z.number().int().min(0).max(2048),
    bottom: z.number().int().min(0).max(2048),
    left: z.number().int().min(0).max(2048),
  })
  .strict();
export type LogoSafeZone = z.infer<typeof LogoSafeZoneSchema>;

export const LogoVariantSchema = z
  .object({
    kind: LogoVariantKindSchema,
    /** Source URL or workspace asset path. Validated to be non-empty. */
    src: z.string().min(1).max(2048),
    intrinsicWidth: z.number().int().min(1).max(8192),
    intrinsicHeight: z.number().int().min(1).max(8192),
    safeZone: LogoSafeZoneSchema.optional(),
    /** Short usage hint shown to authors (e.g. "for dark backgrounds"). */
    usageHint: z.string().max(280).optional(),
  })
  .strict();
export type LogoVariant = z.infer<typeof LogoVariantSchema>;

/* ---------------------------------------------------------------------------
 * Palette
 * ------------------------------------------------------------------------- */

/** A solid colour with an explicit foreground that should sit on top of it. */
export const SemanticColorSchema = z
  .object({
    base: HexColorSchema,
    on: HexColorSchema,
  })
  .strict();
export type SemanticColor = z.infer<typeof SemanticColorSchema>;

export const SemanticPaletteSchema = z
  .object({
    success: SemanticColorSchema,
    warning: SemanticColorSchema,
    danger: SemanticColorSchema,
    info: SemanticColorSchema,
  })
  .strict();
export type SemanticPalette = z.infer<typeof SemanticPaletteSchema>;

export const BrandPaletteSchema = z
  .object({
    primary: ColorScaleSchema,
    secondary: ColorScaleSchema,
    accent: ColorScaleSchema,
    neutral: ColorScaleSchema,
    semantic: SemanticPaletteSchema,
  })
  .strict();
export type BrandPalette = z.infer<typeof BrandPaletteSchema>;

/* ---------------------------------------------------------------------------
 * Typography
 * ------------------------------------------------------------------------- */

const FONT_WEIGHT_VALUE = /^[1-9]00$/;

export const FontFamilySchema = z
  .object({
    /** Primary family name. Quotes are added at CSS-emit time. */
    family: z.string().min(1).max(120),
    /** Fallback stack (innermost → outermost). At least one entry required. */
    fallback: z.array(z.string().min(1).max(60)).min(1).max(8),
    /** Loaded weight values (e.g. ["400", "600", "700"]). */
    weights: z
      .array(
        z.string().refine((s) => FONT_WEIGHT_VALUE.test(s), {
          message: "weights must be 100..900 in hundreds",
        }),
      )
      .min(1)
      .max(9),
  })
  .strict();
export type FontFamily = z.infer<typeof FontFamilySchema>;

export const BrandTypographySchema = z
  .object({
    heading: FontFamilySchema,
    body: FontFamilySchema,
    mono: FontFamilySchema,
    sizeScale: TypeScaleSchema,
    weightScale: WeightScaleSchema,
    /** Vertical baseline grid in pixels. Common values: 4, 8. */
    baselineGridPx: z.number().int().min(2).max(64),
  })
  .strict();
export type BrandTypography = z.infer<typeof BrandTypographySchema>;

/* ---------------------------------------------------------------------------
 * Voice and tone
 * ------------------------------------------------------------------------- */

export const BRAND_FORMALITIES = [
  "formal",
  "neutral",
  "casual",
  "playful",
] as const;
export type BrandFormality = (typeof BRAND_FORMALITIES)[number];
export const BrandFormalitySchema = z.enum(BRAND_FORMALITIES);

export const BRAND_READING_LEVELS = [
  "elementary",
  "middle",
  "high_school",
  "college",
  "professional",
] as const;
export type BrandReadingLevel = (typeof BRAND_READING_LEVELS)[number];
export const BrandReadingLevelSchema = z.enum(BRAND_READING_LEVELS);

export const BrandVoiceSchema = z
  .object({
    formality: BrandFormalitySchema,
    /** Free-form persona description, e.g. "knowledgeable mentor". */
    persona: z.string().max(2000),
    /** Phrases the AI must never produce in copy or alt-text. */
    bannedPhrases: z.array(z.string().min(1).max(280)).max(200),
    /** Phrases the AI should prefer where appropriate. */
    preferredPhrases: z.array(z.string().min(1).max(280)).max(200),
    readingLevel: BrandReadingLevelSchema,
  })
  .strict();
export type BrandVoice = z.infer<typeof BrandVoiceSchema>;

/* ---------------------------------------------------------------------------
 * UI preferences
 * ------------------------------------------------------------------------- */

export const DENSITIES = ["compact", "comfortable", "spacious"] as const;
export type Density = (typeof DENSITIES)[number];
export const DensitySchema = z.enum(DENSITIES);

export const DARK_MODE_STRATEGIES = ["class", "media", "both", "off"] as const;
export type DarkModeStrategy = (typeof DARK_MODE_STRATEGIES)[number];
export const DarkModeStrategySchema = z.enum(DARK_MODE_STRATEGIES);

export const MOTION_PREFERENCES = ["full", "reduced", "auto"] as const;
export type MotionPreference = (typeof MOTION_PREFERENCES)[number];
export const MotionPreferenceSchema = z.enum(MOTION_PREFERENCES);

export const BrandUiPrefsSchema = z
  .object({
    density: DensitySchema,
    radiusScale: RadiusScaleSchema,
    shadowScale: ShadowScaleSchema,
    motionPreference: MotionPreferenceSchema,
    motionDurationScale: MotionDurationScaleSchema,
    darkModeStrategy: DarkModeStrategySchema,
  })
  .strict();
export type BrandUiPrefs = z.infer<typeof BrandUiPrefsSchema>;

/* ---------------------------------------------------------------------------
 * Watermark
 * ------------------------------------------------------------------------- */

export const WATERMARK_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];
export const WatermarkPositionSchema = z.enum(WATERMARK_POSITIONS);

export const WATERMARK_MEDIUMS = ["image", "video"] as const;
export type WatermarkMedium = (typeof WATERMARK_MEDIUMS)[number];
export const WatermarkMediumSchema = z.enum(WATERMARK_MEDIUMS);

export const WatermarkPolicySchema = z
  .object({
    enabled: z.boolean(),
    /**
     * Which `LogoVariantKind` from `BrandTheme.logos` should be rendered as
     * the watermark. Resolution at render time may fall back to `primary`
     * if the requested variant is missing.
     */
    logoVariantKind: LogoVariantKindSchema,
    position: WatermarkPositionSchema,
    /** 0..1, where 0 is invisible and 1 is opaque. Recommended ≤ 0.5. */
    opacity: z.number().min(0).max(1),
    /** Watermark width as a percentage of the asset width (1..100). */
    scalePct: z.number().int().min(1).max(100),
    /** Empty array disables watermark for all mediums (same as enabled=false). */
    mediums: z.array(WatermarkMediumSchema).max(2),
  })
  .strict();
export type WatermarkPolicy = z.infer<typeof WatermarkPolicySchema>;

/* ---------------------------------------------------------------------------
 * Brand theme (top-level)
 * ------------------------------------------------------------------------- */

export const BrandThemeSchema = z
  .object({
    id: z.string().min(1).max(120),
    name: z.string().min(1).max(120),
    /** Logo variants. Keep at most 20 to bound storage. */
    logos: z.array(LogoVariantSchema).max(20),
    palette: BrandPaletteSchema,
    /**
     * Optional dedicated dark-mode palette. When `darkModeStrategy === "off"`
     * this should be omitted. When omitted with a non-off strategy, the
     * runtime should derive dark colours from `palette` automatically.
     */
    darkPalette: BrandPaletteSchema.optional(),
    typography: BrandTypographySchema,
    voice: BrandVoiceSchema,
    ui: BrandUiPrefsSchema,
    watermark: WatermarkPolicySchema,
    /** Schema version. Bumped on breaking shape changes. */
    version: z.number().int().min(1),
    /** ISO-8601 timestamp of the most recent edit. */
    updatedAt: z.string().min(1).max(64).optional(),
  })
  .strict();
export type BrandTheme = z.infer<typeof BrandThemeSchema>;

/* ---------------------------------------------------------------------------
 * Override schema (workspace → format → asset chain).
 * Shallow per top-level slice; full-replace for nested arrays/objects.
 * Deeper merges are handled by `resolveBrandTheme` in CP-1.C.3.
 * ------------------------------------------------------------------------- */

export const BrandThemeOverrideSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    logos: z.array(LogoVariantSchema).max(20).optional(),
    palette: BrandPaletteSchema.partial().optional(),
    darkPalette: BrandPaletteSchema.optional(),
    typography: BrandTypographySchema.partial().optional(),
    voice: BrandVoiceSchema.partial().optional(),
    ui: BrandUiPrefsSchema.partial().optional(),
    watermark: WatermarkPolicySchema.partial().optional(),
  })
  .strict();
export type BrandThemeOverride = z.infer<typeof BrandThemeOverrideSchema>;

/* ---------------------------------------------------------------------------
 * Default theme
 *
 * Neutral safe defaults. All semantic-on-base pairs were hand-checked to meet
 * WCAG AA Normal (≥ 4.5:1). Colour scales follow Tailwind's slate / blue /
 * emerald / gray reference scales for predictable cross-system mapping.
 * ------------------------------------------------------------------------- */

const SLATE_SCALE = {
  "50": "#f8fafc",
  "100": "#f1f5f9",
  "200": "#e2e8f0",
  "300": "#cbd5e1",
  "400": "#94a3b8",
  "500": "#64748b",
  "600": "#475569",
  "700": "#334155",
  "800": "#1e293b",
  "900": "#0f172a",
  "950": "#020617",
};

const BLUE_SCALE = {
  "50": "#eff6ff",
  "100": "#dbeafe",
  "200": "#bfdbfe",
  "300": "#93c5fd",
  "400": "#60a5fa",
  "500": "#3b82f6",
  "600": "#2563eb",
  "700": "#1d4ed8",
  "800": "#1e40af",
  "900": "#1e3a8a",
  "950": "#172554",
};

const EMERALD_SCALE = {
  "50": "#ecfdf5",
  "100": "#d1fae5",
  "200": "#a7f3d0",
  "300": "#6ee7b7",
  "400": "#34d399",
  "500": "#10b981",
  "600": "#059669",
  "700": "#047857",
  "800": "#065f46",
  "900": "#064e3b",
  "950": "#022c22",
};

const GRAY_SCALE = {
  "50": "#f9fafb",
  "100": "#f3f4f6",
  "200": "#e5e7eb",
  "300": "#d1d5db",
  "400": "#9ca3af",
  "500": "#6b7280",
  "600": "#4b5563",
  "700": "#374151",
  "800": "#1f2937",
  "900": "#111827",
  "950": "#030712",
};

const SYSTEM_FONT_FALLBACK = [
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Helvetica",
  "Arial",
  "sans-serif",
];

const SYSTEM_MONO_FALLBACK = [
  "ui-monospace",
  "SFMono-Regular",
  "Menlo",
  "Monaco",
  "Consolas",
  "monospace",
];

/**
 * The default white-label theme. Tenants start from this and override.
 * Treat as immutable; copy-and-modify rather than mutating in place.
 */
export const DEFAULT_BRAND_THEME: BrandTheme = {
  id: "default",
  name: "Default",
  logos: [],
  palette: {
    primary: SLATE_SCALE,
    secondary: BLUE_SCALE,
    accent: EMERALD_SCALE,
    neutral: GRAY_SCALE,
    semantic: {
      // tailwind-ish 700-level swatches; on=#fff passes WCAG AA Normal
      success: { base: "#15803d", on: "#ffffff" },
      warning: { base: "#b45309", on: "#ffffff" },
      danger: { base: "#b91c1c", on: "#ffffff" },
      info: { base: "#1d4ed8", on: "#ffffff" },
    },
  },
  typography: {
    heading: {
      family: "Inter",
      fallback: SYSTEM_FONT_FALLBACK,
      weights: ["400", "500", "600", "700"],
    },
    body: {
      family: "Inter",
      fallback: SYSTEM_FONT_FALLBACK,
      weights: ["400", "500", "600"],
    },
    mono: {
      family: "JetBrains Mono",
      fallback: SYSTEM_MONO_FALLBACK,
      weights: ["400", "500"],
    },
    sizeScale: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "3.75rem",
    },
    weightScale: {
      thin: "100",
      extralight: "200",
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "900",
    },
    baselineGridPx: 4,
  },
  voice: {
    formality: "neutral",
    persona: "Helpful, knowledgeable, and concise.",
    bannedPhrases: [],
    preferredPhrases: [],
    readingLevel: "high_school",
  },
  ui: {
    density: "comfortable",
    radiusScale: {
      none: "0px",
      sm: "2px",
      md: "6px",
      lg: "8px",
      xl: "12px",
      "2xl": "16px",
      full: "9999px",
    },
    shadowScale: {
      "0": "none",
      "1": "0 1px 2px rgba(0,0,0,0.05)",
      "2": "0 1px 3px rgba(0,0,0,0.1)",
      "3": "0 4px 6px rgba(0,0,0,0.1)",
      "4": "0 10px 15px rgba(0,0,0,0.1)",
      "5": "0 25px 50px rgba(0,0,0,0.25)",
    },
    motionPreference: "auto",
    motionDurationScale: {
      instant: "0ms",
      fast: "100ms",
      normal: "200ms",
      slow: "300ms",
      slowest: "500ms",
    },
    darkModeStrategy: "class",
  },
  watermark: {
    enabled: false,
    logoVariantKind: "primary",
    position: "bottom-right",
    opacity: 0.5,
    scalePct: 12,
    mediums: ["image"],
  },
  version: 1,
};

/* ---------------------------------------------------------------------------
 * Override resolution (workspace → format → asset)
 * ------------------------------------------------------------------------- */

/**
 * Drop keys whose values are explicitly `undefined` so a partial override
 * doesn't blank out an existing field via spread. Returns a shallow copy.
 */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      out[key] = obj[key];
    }
  }
  return out;
}

function applyOverride(
  base: BrandTheme,
  override: BrandThemeOverride | undefined,
): BrandTheme {
  if (!override) return base;

  const next: BrandTheme = {
    ...base,
    name: override.name ?? base.name,
    logos: override.logos ?? base.logos,
    palette: override.palette
      ? {
          ...base.palette,
          ...stripUndefined(override.palette),
          semantic: override.palette.semantic
            ? { ...base.palette.semantic, ...stripUndefined(override.palette.semantic) }
            : base.palette.semantic,
        }
      : base.palette,
    darkPalette: override.darkPalette ?? base.darkPalette,
    typography: override.typography
      ? { ...base.typography, ...stripUndefined(override.typography) }
      : base.typography,
    voice: override.voice
      ? { ...base.voice, ...stripUndefined(override.voice) }
      : base.voice,
    ui: override.ui
      ? { ...base.ui, ...stripUndefined(override.ui) }
      : base.ui,
    watermark: override.watermark
      ? { ...base.watermark, ...stripUndefined(override.watermark) }
      : base.watermark,
  };

  return next;
}

export interface ResolveBrandThemeArgs {
  workspace: BrandTheme;
  format?: BrandThemeOverride;
  asset?: BrandThemeOverride;
}

/**
 * Compose the effective theme for a render call. Override precedence:
 * `asset` beats `format` beats `workspace`. Use `BrandThemeSchema.parse`
 * on the result to keep callers honest.
 */
export function resolveBrandTheme(args: ResolveBrandThemeArgs): BrandTheme {
  const afterFormat = applyOverride(args.workspace, args.format);
  return applyOverride(afterFormat, args.asset);
}

/* ---------------------------------------------------------------------------
 * CSS variable + JSON token export
 * ------------------------------------------------------------------------- */

const COLOR_SCALE_STEPS_ORDERED: readonly (keyof ColorScale)[] = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const;

const SEMANTIC_KEYS = ["success", "warning", "danger", "info"] as const;

const TYPE_SIZE_KEYS = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
] as const;

const WEIGHT_KEYS = [
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
] as const;

const RADIUS_KEYS = [
  "none",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "full",
] as const;

const SHADOW_KEYS = ["0", "1", "2", "3", "4", "5"] as const;
const MOTION_KEYS = ["instant", "fast", "normal", "slow", "slowest"] as const;

/**
 * Build a CSS font-family value. The primary family is always quoted (covers
 * multi-word names like `JetBrains Mono`) and fallbacks are emitted bare so
 * generic keywords (`system-ui`, `sans-serif`) keep their CSS semantics.
 */
function fontFamilyCssValue(family: string, fallback: readonly string[]): string {
  return [`"${family}"`, ...fallback].join(", ");
}

export interface ThemeToCssOptions {
  /** Custom property prefix. Defaults to `brand-` (yielding `--brand-...`). */
  prefix?: string;
}

/**
 * Emit a deterministic `Record<string, string>` of CSS custom properties
 * (kebab-cased keys, no `--` prefix on the keys themselves — render layer
 * adds the `--` when concatenating). Keys are inserted in fixed order so
 * stringified output is stable across runs.
 */
export function themeToCssVariables(
  theme: BrandTheme,
  options: ThemeToCssOptions = {},
): Record<string, string> {
  const prefix = options.prefix ?? "brand-";
  const out: Record<string, string> = {};

  for (const role of ["primary", "secondary", "accent", "neutral"] as const) {
    const scale = theme.palette[role];
    for (const step of COLOR_SCALE_STEPS_ORDERED) {
      out[`${prefix}${role}-${step}`] = scale[step];
    }
  }

  for (const key of SEMANTIC_KEYS) {
    out[`${prefix}semantic-${key}-base`] = theme.palette.semantic[key].base;
    out[`${prefix}semantic-${key}-on`] = theme.palette.semantic[key].on;
  }

  out[`${prefix}font-heading`] = fontFamilyCssValue(
    theme.typography.heading.family,
    theme.typography.heading.fallback,
  );
  out[`${prefix}font-body`] = fontFamilyCssValue(
    theme.typography.body.family,
    theme.typography.body.fallback,
  );
  out[`${prefix}font-mono`] = fontFamilyCssValue(
    theme.typography.mono.family,
    theme.typography.mono.fallback,
  );

  for (const k of TYPE_SIZE_KEYS) {
    out[`${prefix}font-size-${k}`] = theme.typography.sizeScale[k];
  }

  for (const k of WEIGHT_KEYS) {
    out[`${prefix}font-weight-${k}`] = theme.typography.weightScale[k];
  }

  for (const k of RADIUS_KEYS) {
    out[`${prefix}radius-${k}`] = theme.ui.radiusScale[k];
  }

  for (const k of SHADOW_KEYS) {
    out[`${prefix}shadow-${k}`] = theme.ui.shadowScale[k];
  }

  for (const k of MOTION_KEYS) {
    out[`${prefix}motion-${k}`] = theme.ui.motionDurationScale[k];
  }

  out[`${prefix}baseline-grid`] = `${theme.typography.baselineGridPx}px`;

  return out;
}

/**
 * Emit a flat token map suitable for serialising as JSON. Keys are
 * dotted (`brand.primary.50`, `brand.semantic.success.base`) and the
 * returned record has keys inserted in alphabetical order so stringified
 * JSON is byte-stable.
 */
export function themeToTokensJson(theme: BrandTheme): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const role of ["primary", "secondary", "accent", "neutral"] as const) {
    const scale = theme.palette[role];
    for (const step of COLOR_SCALE_STEPS_ORDERED) {
      flat[`brand.${role}.${step}`] = scale[step];
    }
  }

  for (const key of SEMANTIC_KEYS) {
    flat[`brand.semantic.${key}.base`] = theme.palette.semantic[key].base;
    flat[`brand.semantic.${key}.on`] = theme.palette.semantic[key].on;
  }

  flat["brand.typography.heading.family"] = theme.typography.heading.family;
  flat["brand.typography.body.family"] = theme.typography.body.family;
  flat["brand.typography.mono.family"] = theme.typography.mono.family;

  for (const k of TYPE_SIZE_KEYS) {
    flat[`brand.size.${k}`] = theme.typography.sizeScale[k];
  }
  for (const k of WEIGHT_KEYS) {
    flat[`brand.weight.${k}`] = theme.typography.weightScale[k];
  }
  for (const k of RADIUS_KEYS) {
    flat[`brand.radius.${k}`] = theme.ui.radiusScale[k];
  }
  for (const k of SHADOW_KEYS) {
    flat[`brand.shadow.${k}`] = theme.ui.shadowScale[k];
  }
  for (const k of MOTION_KEYS) {
    flat[`brand.motion.${k}`] = theme.ui.motionDurationScale[k];
  }
  flat["brand.baseline-grid"] = `${theme.typography.baselineGridPx}px`;

  // Sorted insertion for byte-stable JSON.stringify output.
  const sortedKeys = Object.keys(flat).sort();
  const sorted: Record<string, string> = {};
  for (const k of sortedKeys) {
    sorted[k] = flat[k];
  }
  return sorted;
}

/* ---------------------------------------------------------------------------
 * Adapter from the thin persistence shape (`WorkspaceBranding` in index.ts)
 * to a full `BrandTheme`. Decoupled via structural typing so we don't
 * import index.ts (which would create a circular import).
 * ------------------------------------------------------------------------- */

interface WorkspaceBrandingLike {
  displayName?: string;
  tagline?: string;
  logoUrl?: string;
  primaryHex?: string;
  accentHex?: string;
  businessCategoryId?: string;
}

const WHITE_HEX = "#ffffff";
const BLACK_HEX = "#000000";

function mixHex(a: string, b: string, t: number): string {
  const ah = normaliseHex(a);
  const bh = normaliseHex(b);
  const ar = parseInt(ah.slice(1, 3), 16);
  const ag = parseInt(ah.slice(3, 5), 16);
  const ab = parseInt(ah.slice(5, 7), 16);
  const br = parseInt(bh.slice(1, 3), 16);
  const bg = parseInt(bh.slice(3, 5), 16);
  const bb = parseInt(bh.slice(5, 7), 16);
  const r = Math.round(ar * (1 - t) + br * t);
  const g = Math.round(ag * (1 - t) + bg * t);
  const blue = Math.round(ab * (1 - t) + bb * t);
  return `#${[r, g, blue]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Generate an 11-step color scale anchored at `baseHex` (placed at "500"),
 * lightening toward white above and darkening toward black below. This is
 * a v1 best-effort meant for theme bootstrap; production tenants should
 * upload a designer-tuned scale.
 */
export function tintScaleFromHex(baseHex: string): ColorScale {
  const base = normaliseHex(baseHex);
  return {
    "50": mixHex(base, WHITE_HEX, 0.95),
    "100": mixHex(base, WHITE_HEX, 0.85),
    "200": mixHex(base, WHITE_HEX, 0.65),
    "300": mixHex(base, WHITE_HEX, 0.45),
    "400": mixHex(base, WHITE_HEX, 0.2),
    "500": base,
    "600": mixHex(base, BLACK_HEX, 0.15),
    "700": mixHex(base, BLACK_HEX, 0.3),
    "800": mixHex(base, BLACK_HEX, 0.45),
    "900": mixHex(base, BLACK_HEX, 0.6),
    "950": mixHex(base, BLACK_HEX, 0.75),
  };
}

export interface BrandingToThemeOptions {
  /** Override the generated theme id. Defaults to `from-branding`. */
  id?: string;
  /** Defaults to 1024×1024 for the generated logo when only a URL is known. */
  logoIntrinsic?: { width: number; height: number };
}

/**
 * Adapter: lift a sparse `WorkspaceBranding` row into a fully-populated
 * `BrandTheme`. Missing fields fall through to `DEFAULT_BRAND_THEME`.
 * If `primaryHex` or `accentHex` is set, the corresponding scale is
 * generated via `tintScaleFromHex`.
 */
export function brandingToTheme(
  branding: WorkspaceBrandingLike,
  options: BrandingToThemeOptions = {},
): BrandTheme {
  const logos: LogoVariant[] = [];
  if (branding.logoUrl) {
    logos.push({
      kind: "primary",
      src: branding.logoUrl,
      intrinsicWidth: options.logoIntrinsic?.width ?? 1024,
      intrinsicHeight: options.logoIntrinsic?.height ?? 1024,
      usageHint: branding.displayName
        ? `Primary logo for ${branding.displayName}`
        : undefined,
    });
  }

  const palette: BrandPalette = {
    ...DEFAULT_BRAND_THEME.palette,
    ...(branding.primaryHex
      ? { primary: tintScaleFromHex(branding.primaryHex) }
      : {}),
    ...(branding.accentHex
      ? { accent: tintScaleFromHex(branding.accentHex) }
      : {}),
  };

  return {
    ...DEFAULT_BRAND_THEME,
    id: options.id ?? "from-branding",
    name: branding.displayName ?? "Custom",
    logos,
    palette,
  };
}

/* ---------------------------------------------------------------------------
 * Lint
 *
 * Surface ranked warnings to the workspace owner without ever blocking a
 * commit. Severity reflects publishability impact, not code quality:
 *  - "error":   would damage the published asset (contrast failure, missing
 *               watermark logo, voice contract violation).
 *  - "warning": likely poor UX or accessibility risk.
 *  - "info":    advisory; product can resolve at render time.
 * ------------------------------------------------------------------------- */

export type BrandThemeWarningSeverity = "error" | "warning" | "info";

export const BRAND_THEME_WARNING_CODES = [
  "contrast.primary-on-neutral-50",
  "contrast.body-text-on-bg",
  "contrast.semantic",
  "fallback.no-generic-tail",
  "watermark.opacity-high",
  "watermark.missing-variant",
  "voice.banned-and-preferred-overlap",
  "voice.duplicate-phrases",
  "darkpalette.recommended",
] as const;
export type BrandThemeWarningCode = (typeof BRAND_THEME_WARNING_CODES)[number];

export interface BrandThemeWarning {
  severity: BrandThemeWarningSeverity;
  code: BrandThemeWarningCode;
  message: string;
  /** Dotted path to the offending field (e.g. "palette.semantic.success"). */
  field: string;
}

const GENERIC_FONT_TAILS = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "system-ui",
  "ui-monospace",
  "ui-serif",
  "ui-sans-serif",
  "cursive",
  "fantasy",
]);

/**
 * Run all lint checks against a fully-resolved theme. Returns warnings in
 * declaration order (callers can sort by severity if they prefer).
 */
export function lintBrandTheme(theme: BrandTheme): BrandThemeWarning[] {
  const out: BrandThemeWarning[] = [];

  const primaryRatio = contrastRatio(
    theme.palette.primary["500"],
    theme.palette.neutral["50"],
  );
  if (primaryRatio < WCAG_AA_NORMAL) {
    out.push({
      severity: "warning",
      code: "contrast.primary-on-neutral-50",
      message: `primary.500 on neutral.50 yields contrast ${primaryRatio.toFixed(2)}; below WCAG AA Normal (${WCAG_AA_NORMAL})`,
      field: "palette.primary",
    });
  }

  const bodyRatio = contrastRatio(
    theme.palette.neutral["900"],
    theme.palette.neutral["50"],
  );
  if (bodyRatio < WCAG_AA_NORMAL) {
    out.push({
      severity: "error",
      code: "contrast.body-text-on-bg",
      message: `neutral.900 on neutral.50 yields contrast ${bodyRatio.toFixed(2)}; body text needs ≥ ${WCAG_AA_NORMAL}`,
      field: "palette.neutral",
    });
  }

  for (const key of ["success", "warning", "danger", "info"] as const) {
    const sem = theme.palette.semantic[key];
    const r = contrastRatio(sem.on, sem.base);
    if (r < WCAG_AA_NORMAL) {
      out.push({
        severity: "warning",
        code: "contrast.semantic",
        message: `semantic.${key} on/base contrast ${r.toFixed(2)}; below WCAG AA Normal`,
        field: `palette.semantic.${key}`,
      });
    }
  }

  for (const role of ["heading", "body", "mono"] as const) {
    const fallback = theme.typography[role].fallback;
    const tail = fallback[fallback.length - 1];
    if (!GENERIC_FONT_TAILS.has(tail)) {
      out.push({
        severity: "warning",
        code: "fallback.no-generic-tail",
        message: `typography.${role}.fallback should end with a generic family (sans-serif, serif, monospace, system-ui, etc.)`,
        field: `typography.${role}.fallback`,
      });
    }
  }

  if (theme.watermark.enabled) {
    if (theme.watermark.opacity > 0.7) {
      out.push({
        severity: "warning",
        code: "watermark.opacity-high",
        message: `watermark opacity ${theme.watermark.opacity} is high; may obscure asset content`,
        field: "watermark.opacity",
      });
    }

    const variant = theme.logos.find(
      (l) => l.kind === theme.watermark.logoVariantKind,
    );
    if (!variant) {
      out.push({
        severity: "error",
        code: "watermark.missing-variant",
        message: `watermark requires logos[kind="${theme.watermark.logoVariantKind}"] but it is not uploaded`,
        field: "watermark.logoVariantKind",
      });
    }
  }

  const bannedSet = new Set(
    theme.voice.bannedPhrases.map((p) => p.toLowerCase()),
  );
  for (const pref of theme.voice.preferredPhrases) {
    if (bannedSet.has(pref.toLowerCase())) {
      out.push({
        severity: "error",
        code: "voice.banned-and-preferred-overlap",
        message: `phrase "${pref}" appears in both bannedPhrases and preferredPhrases`,
        field: "voice",
      });
    }
  }

  const seenBanned = new Set<string>();
  for (const phrase of theme.voice.bannedPhrases) {
    const k = phrase.toLowerCase();
    if (seenBanned.has(k)) {
      out.push({
        severity: "info",
        code: "voice.duplicate-phrases",
        message: `duplicate banned phrase "${phrase}"`,
        field: "voice.bannedPhrases",
      });
    }
    seenBanned.add(k);
  }

  const seenPreferred = new Set<string>();
  for (const phrase of theme.voice.preferredPhrases) {
    const k = phrase.toLowerCase();
    if (seenPreferred.has(k)) {
      out.push({
        severity: "info",
        code: "voice.duplicate-phrases",
        message: `duplicate preferred phrase "${phrase}"`,
        field: "voice.preferredPhrases",
      });
    }
    seenPreferred.add(k);
  }

  if (theme.ui.darkModeStrategy !== "off" && !theme.darkPalette) {
    out.push({
      severity: "info",
      code: "darkpalette.recommended",
      message: `darkPalette is recommended when darkModeStrategy is "${theme.ui.darkModeStrategy}"`,
      field: "darkPalette",
    });
  }

  return out;
}
