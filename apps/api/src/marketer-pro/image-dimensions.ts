/**
 * Network → image dimensions and DALL-E 3 size bucket.
 * DALL-E 3 supports: "1024x1024" | "1792x1024" | "1024x1792"
 */

export type DallE3Size = "1024x1024" | "1792x1024" | "1024x1792";

export type ImageDimensions = {
  readonly width: number;
  readonly height: number;
  readonly dalleSize: DallE3Size;
  readonly label: string;
};

const DIMENSIONS: Record<string, ImageDimensions> = {
  instagram:  { width: 1080, height: 1080, dalleSize: "1024x1024",  label: "Instagram square (1:1)" },
  instagram_story: { width: 1080, height: 1920, dalleSize: "1024x1792", label: "Instagram story (9:16)" },
  facebook:   { width: 1200, height: 630,  dalleSize: "1792x1024",  label: "Facebook feed (1.91:1)" },
  meta:       { width: 1200, height: 630,  dalleSize: "1792x1024",  label: "Facebook feed (1.91:1)" },
  x:          { width: 1200, height: 675,  dalleSize: "1792x1024",  label: "X/Twitter (16:9)" },
  linkedin:   { width: 1200, height: 627,  dalleSize: "1792x1024",  label: "LinkedIn (1.91:1)" },
  youtube:    { width: 1280, height: 720,  dalleSize: "1792x1024",  label: "YouTube thumbnail (16:9)" },
  youtube_shorts: { width: 1080, height: 1920, dalleSize: "1024x1792", label: "YouTube Shorts (9:16)" },
  tiktok:     { width: 1080, height: 1920, dalleSize: "1024x1792",  label: "TikTok (9:16)" },
  pinterest:  { width: 1000, height: 1500, dalleSize: "1024x1792",  label: "Pinterest (2:3)" },
  generic:    { width: 1080, height: 1080, dalleSize: "1024x1024",  label: "Generic square (1:1)" },
};

const FALLBACK: ImageDimensions = DIMENSIONS.generic!;

export function getDimensions(network: string | null | undefined): ImageDimensions {
  if (!network) return FALLBACK;
  return DIMENSIONS[network.toLowerCase()] ?? FALLBACK;
}
