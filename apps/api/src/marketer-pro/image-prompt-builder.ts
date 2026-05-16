/**
 * Build a DALL-E 3 image generation prompt from a GenerationBrief
 * and optional brand context.
 */

import type { GenerationBrief } from "@home-link/marketer-pro-contract";
import type { ImageDimensions } from "./image-dimensions.js";

export type ImagePromptInput = {
  readonly brief: GenerationBrief;
  readonly dimensions: ImageDimensions;
  readonly brandName?: string;
  readonly brandPrimaryColor?: string;
  readonly brandStyle?: string;
};

export function buildImagePrompt(input: ImagePromptInput): string {
  const { brief, dimensions, brandName, brandPrimaryColor, brandStyle } = input;
  const parts: string[] = [];

  // Core subject from copy directives
  const headline = brief.copy.headline?.trim();
  const body = brief.copy.body?.trim();
  const subject = headline ?? (body ? body.slice(0, 120) : null);

  if (subject) {
    parts.push(`Create a professional marketing image for: "${subject}".`);
  } else {
    parts.push("Create a professional marketing image.");
  }

  // Design directives
  const design = brief.design;
  if (design) {
    if (design.imageryDirection) {
      parts.push(`Visual direction: ${design.imageryDirection}.`);
    }
    if (design.imageryQuery) {
      parts.push(`Imagery: ${design.imageryQuery}.`);
    }
    if (design.mood) {
      parts.push(`Mood: ${design.mood}.`);
    }
    if (design.layoutIntent) {
      parts.push(`Layout: ${design.layoutIntent}.`);
    }
    if (design.customPaletteHex?.length) {
      parts.push(`Color palette: ${design.customPaletteHex.join(", ")}.`);
    } else if (brandPrimaryColor) {
      parts.push(`Primary brand color: ${brandPrimaryColor}.`);
    }
  }

  // Brand context
  if (brandName) parts.push(`Brand: ${brandName}.`);
  if (brandStyle) parts.push(`Brand style: ${brandStyle}.`);

  // Platform framing
  parts.push(`Format: ${dimensions.label}, optimized for digital marketing.`);

  // Quality guardrails
  parts.push(
    "No text overlaid on the image. Photorealistic or high-quality illustration. " +
    "Clean composition. No watermarks. Professional quality."
  );

  return parts.join(" ");
}
