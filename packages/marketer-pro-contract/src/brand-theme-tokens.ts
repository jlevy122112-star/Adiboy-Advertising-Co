import { z } from "zod";

/**
 * Primitive design-token schemas used by the BrandTheme contract.
 * No dependency on any other contract file: pure shapes + pure functions.
 */

const HEX_3 = /^#[0-9a-fA-F]{3}$/;
const HEX_6 = /^#[0-9a-fA-F]{6}$/;
const HEX_8 = /^#[0-9a-fA-F]{8}$/;

/** Validates `#rgb`, `#rrggbb`, or `#rrggbbaa`. Case-insensitive. */
export const HexColorSchema = z
  .string()
  .refine((s) => HEX_3.test(s) || HEX_6.test(s) || HEX_8.test(s), {
    message: "must be #rgb, #rrggbb, or #rrggbbaa",
  });
export type HexColor = z.infer<typeof HexColorSchema>;

/**
 * CSS length restricted to the units a render pipeline can compute reliably.
 * We deliberately exclude `%`, `vw`, `vh`, `ch` (font-relative behaviour drifts
 * across embed contexts and would break asset rasterisation determinism).
 */
const CSS_SIZE = /^-?\d+(\.\d+)?(px|rem|em)$/;
export const CssSizeSchema = z.string().refine((s) => CSS_SIZE.test(s), {
  message: "must be a CSS length like 16px, 1rem, or 1.5em",
});
export type CssSize = z.infer<typeof CssSizeSchema>;

const CSS_DURATION = /^\d+(\.\d+)?(ms|s)$/;
export const CssDurationSchema = z.string().refine((s) => CSS_DURATION.test(s), {
  message: "must be a CSS duration like 200ms or 0.3s",
});
export type CssDuration = z.infer<typeof CssDurationSchema>;

/* ---------------------------------------------------------------------------
 * Color scale (Tailwind-compatible: 50, 100, ..., 900, 950)
 * ------------------------------------------------------------------------- */

export const COLOR_SCALE_STEPS = [
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
export type ColorScaleStep = (typeof COLOR_SCALE_STEPS)[number];

export const ColorScaleSchema = z
  .object({
    "50": HexColorSchema,
    "100": HexColorSchema,
    "200": HexColorSchema,
    "300": HexColorSchema,
    "400": HexColorSchema,
    "500": HexColorSchema,
    "600": HexColorSchema,
    "700": HexColorSchema,
    "800": HexColorSchema,
    "900": HexColorSchema,
    "950": HexColorSchema,
  })
  .strict();
export type ColorScale = z.infer<typeof ColorScaleSchema>;

/* ---------------------------------------------------------------------------
 * Type scale (xs .. 6xl, semantic names matching common design systems)
 * ------------------------------------------------------------------------- */

export const TYPE_SCALE_STEPS = [
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
export type TypeScaleStep = (typeof TYPE_SCALE_STEPS)[number];

export const TypeScaleSchema = z
  .object({
    xs: CssSizeSchema,
    sm: CssSizeSchema,
    base: CssSizeSchema,
    lg: CssSizeSchema,
    xl: CssSizeSchema,
    "2xl": CssSizeSchema,
    "3xl": CssSizeSchema,
    "4xl": CssSizeSchema,
    "5xl": CssSizeSchema,
    "6xl": CssSizeSchema,
  })
  .strict();
export type TypeScale = z.infer<typeof TypeScaleSchema>;

/* ---------------------------------------------------------------------------
 * Font-weight scale (semantic keys → numeric weight strings)
 * ------------------------------------------------------------------------- */

export const WEIGHT_SCALE_STEPS = [
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
export type WeightScaleStep = (typeof WEIGHT_SCALE_STEPS)[number];

const WEIGHT_VALUE = /^[1-9]00$/;
const WeightValueSchema = z.string().refine((s) => WEIGHT_VALUE.test(s), {
  message: "must be a numeric font weight 100..900",
});

export const WeightScaleSchema = z
  .object({
    thin: WeightValueSchema,
    extralight: WeightValueSchema,
    light: WeightValueSchema,
    normal: WeightValueSchema,
    medium: WeightValueSchema,
    semibold: WeightValueSchema,
    bold: WeightValueSchema,
    extrabold: WeightValueSchema,
    black: WeightValueSchema,
  })
  .strict();
export type WeightScale = z.infer<typeof WeightScaleSchema>;

/* ---------------------------------------------------------------------------
 * Radius / shadow / motion scales
 * ------------------------------------------------------------------------- */

export const RADIUS_SCALE_STEPS = [
  "none",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "full",
] as const;
export type RadiusScaleStep = (typeof RADIUS_SCALE_STEPS)[number];

export const RadiusScaleSchema = z
  .object({
    none: CssSizeSchema,
    sm: CssSizeSchema,
    md: CssSizeSchema,
    lg: CssSizeSchema,
    xl: CssSizeSchema,
    "2xl": CssSizeSchema,
    /** `full` is conventionally 9999px / 50% — keep CssSize so it round-trips. */
    full: CssSizeSchema,
  })
  .strict();
export type RadiusScale = z.infer<typeof RadiusScaleSchema>;

export const SHADOW_ELEVATION_STEPS = ["0", "1", "2", "3", "4", "5"] as const;
export type ShadowElevationStep = (typeof SHADOW_ELEVATION_STEPS)[number];

/** A CSS box-shadow value (validation is intentionally lenient — many shapes). */
export const ShadowValueSchema = z.string().min(1).max(500);

export const ShadowScaleSchema = z
  .object({
    "0": ShadowValueSchema,
    "1": ShadowValueSchema,
    "2": ShadowValueSchema,
    "3": ShadowValueSchema,
    "4": ShadowValueSchema,
    "5": ShadowValueSchema,
  })
  .strict();
export type ShadowScale = z.infer<typeof ShadowScaleSchema>;

export const MOTION_DURATION_STEPS = [
  "instant",
  "fast",
  "normal",
  "slow",
  "slowest",
] as const;
export type MotionDurationStep = (typeof MOTION_DURATION_STEPS)[number];

export const MotionDurationScaleSchema = z
  .object({
    instant: CssDurationSchema,
    fast: CssDurationSchema,
    normal: CssDurationSchema,
    slow: CssDurationSchema,
    slowest: CssDurationSchema,
  })
  .strict();
export type MotionDurationScale = z.infer<typeof MotionDurationScaleSchema>;

/* ---------------------------------------------------------------------------
 * WCAG contrast thresholds
 * ------------------------------------------------------------------------- */

/** Body text against background, normal weight. */
export const WCAG_AA_NORMAL = 4.5;
/** Large/bold text (≥ 18pt or ≥ 14pt bold) against background. */
export const WCAG_AA_LARGE = 3;
/** Stricter conformance level for body text. */
export const WCAG_AAA_NORMAL = 7;

/* ---------------------------------------------------------------------------
 * Color math (sRGB → relative luminance → contrast ratio).
 * Reference: WCAG 2.x §1.4.3, https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * ------------------------------------------------------------------------- */

function expandShortHex(hex: string): string {
  if (HEX_3.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
}

function srgbChannel(byte: number): number {
  const c = byte / 255;
  return c < 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance for a hex color. Alpha is ignored. Returns 0..1. */
export function relativeLuminance(hex: string): number {
  if (!HEX_3.test(hex) && !HEX_6.test(hex) && !HEX_8.test(hex)) {
    throw new Error(`relativeLuminance: invalid hex "${hex}"`);
  }
  const expanded = expandShortHex(hex);
  const rgbOnly = expanded.length === 9 ? expanded.slice(0, 7) : expanded;
  const r = parseInt(rgbOnly.slice(1, 3), 16);
  const g = parseInt(rgbOnly.slice(3, 5), 16);
  const b = parseInt(rgbOnly.slice(5, 7), 16);
  return (
    0.2126 * srgbChannel(r) +
    0.7152 * srgbChannel(g) +
    0.0722 * srgbChannel(b)
  );
}

/** WCAG contrast ratio between two hex colors (alpha ignored). Returns ≥ 1. */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True if `fg` on `bg` meets the given WCAG threshold. */
export function meetsContrast(
  fg: string,
  bg: string,
  threshold: number = WCAG_AA_NORMAL,
): boolean {
  return contrastRatio(fg, bg) >= threshold;
}

/** Canonical lowercase 6-digit hex form. Throws on invalid input. */
export function normaliseHex(hex: string): string {
  if (!HEX_3.test(hex) && !HEX_6.test(hex) && !HEX_8.test(hex)) {
    throw new Error(`normaliseHex: invalid hex "${hex}"`);
  }
  return expandShortHex(hex).toLowerCase();
}
