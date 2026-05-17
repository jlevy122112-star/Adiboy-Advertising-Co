/**
 * Build a DALL-E 3 image generation prompt from a GenerationBrief
 * and full brand context. Enterprise ad quality output.
 */

import type { GenerationBrief } from "@home-link/marketer-pro-contract";
import type { ImageDimensions } from "./image-dimensions.js";
import type { BrandContext } from "./brand-context-builder.js";
import { getIndustryAdGuidance } from "./brand-context-builder.js";

export type ImagePromptInput = {
  readonly brief: GenerationBrief;
  readonly dimensions: ImageDimensions;
  readonly brand?: BrandContext;
  /** @deprecated use brand.brandName */
  readonly brandName?: string;
  /** @deprecated use brand.primaryHex */
  readonly brandPrimaryColor?: string;
  readonly brandStyle?: string;
  /** Optional user-supplied custom instruction override. */
  readonly customInstruction?: string;
};

const AD_FORMAT_GUIDANCE: Record<string, string> = {
  "Facebook feed (1.91:1)":
    "Facebook feed ad: dominant visual in top 2/3, space in lower third for headline text overlay. Thumb-stopping within 1 second.",
  "Instagram square (1:1)":
    "Instagram feed ad: perfectly balanced square composition. Bold central visual. Works in both grid and feed.",
  "Instagram story (9:16)":
    "Instagram Story ad: full-bleed vertical. Keep important visual in center safe zone (middle 60%). CTA space at bottom.",
  "X/Twitter (16:9)":
    "Twitter/X ad: landscape, bold visual, works at small thumbnail scale. Clear focal point.",
  "LinkedIn (1.91:1)":
    "LinkedIn sponsored ad: professional, business-appropriate. Authority-building visual. Clean and credible.",
  "YouTube thumbnail (16:9)":
    "YouTube thumbnail: high contrast, bold, readable at 128px wide. Clear subject, minimal clutter.",
  "YouTube Shorts (9:16)":
    "YouTube Shorts: vertical full-bleed. Action in center. Engaging within first frame.",
  "TikTok (9:16)":
    "TikTok ad: vertical full-bleed. Authentic, energetic. Clear visual hook in first frame.",
  "Pinterest (2:3)":
    "Pinterest ad: vertical, inspirational lifestyle imagery. Clean, save-worthy aesthetic.",
};

export function buildImagePrompt(input: ImagePromptInput): string {
  const { brief, dimensions, brand, brandStyle, customInstruction } = input;

  // Resolve brand fields (support deprecated flat params for backward compat)
  const brandName = brand?.brandName ?? input.brandName;
  const primaryHex = brand?.primaryHex ?? input.brandPrimaryColor;
  const industryVertical = brand?.industryVertical;
  const slogans = brand?.slogans ?? [];
  const themes = brand?.themes ?? [];
  const persona = brand?.persona;

  const parts: string[] = [];

  // ── Subject from brief ──────────────────────────────────────────────────
  const headline = brief.copy?.headline?.trim();
  const body = brief.copy?.body?.trim();
  const cta = brief.copy?.cta?.trim();
  const subject = headline ?? (body ? body.slice(0, 120) : null);

  if (subject) {
    parts.push(`Create a professional advertising image for: "${subject}".`);
  } else {
    parts.push("Create a professional advertising image.");
  }

  // ── Brand identity ──────────────────────────────────────────────────────
  if (brandName) parts.push(`Brand: ${brandName}.`);

  if (industryVertical) {
    parts.push(`Industry: ${industryVertical}.`);
    const industryGuidance = getIndustryAdGuidance(industryVertical);
    if (industryGuidance) parts.push(`Industry visual style: ${industryGuidance}`);
  }

  if (persona) parts.push(`Brand personality: ${persona}.`);

  if (themes.length > 0) {
    parts.push(`Brand values to convey: ${themes.slice(0, 5).join(", ")}.`);
  }

  if (slogans.length > 0) {
    parts.push(`The primary brand slogan is: "${slogans[0]}". Let the visual communicate this feeling.`);
  }

  if (primaryHex) parts.push(`Dominant brand color: ${primaryHex}.`);
  if (brandStyle) parts.push(`Visual style: ${brandStyle}.`);

  // ── Design directives from brief ────────────────────────────────────────
  const design = brief.design;
  if (design) {
    if (design.imageryDirection) parts.push(`Visual direction: ${design.imageryDirection}.`);
    if (design.imageryQuery) parts.push(`Imagery subject: ${design.imageryQuery}.`);
    if (design.mood) parts.push(`Mood / atmosphere: ${design.mood}.`);
    if (design.layoutIntent) parts.push(`Layout intent: ${design.layoutIntent}.`);
    if (design.customPaletteHex?.length) {
      parts.push(`Color palette: ${design.customPaletteHex.join(", ")}.`);
    }
  }

  if (cta) parts.push(`Ad is driving toward this call-to-action: "${cta}". Visual should support this intent.`);

  // ── Platform / format guidance ──────────────────────────────────────────
  const formatGuidance = AD_FORMAT_GUIDANCE[dimensions.label];
  if (formatGuidance) {
    parts.push(formatGuidance);
  } else {
    parts.push(`Format: ${dimensions.label}, ${dimensions.width}×${dimensions.height}px, optimized for digital advertising.`);
  }

  // ── Custom instruction override ──────────────────────────────────────────
  if (customInstruction?.trim()) {
    parts.push(`Additional direction: ${customInstruction.trim()}`);
  }

  // ── Enterprise quality guardrails ───────────────────────────────────────
  parts.push(
    "Quality requirements: No text overlaid on the image (text is added separately). " +
    "Professional advertising quality — think major brand campaign, not stock photo. " +
    "Photorealistic unless the brand style calls for illustration. " +
    "Clean, intentional composition optimized for digital ad placement. " +
    "No watermarks, logos, or overlays. No generic clip-art aesthetics. " +
    "Lighting should be intentional and flattering. Color grading should feel premium."
  );

  return parts.join(" ");
}
