/**
 * Builds a rich brand context string for injection into generation prompts.
 * Combines WorkspaceBranding + BrandIntelligenceProfile into one structured block.
 */

import type { WorkspaceBranding } from "@home-link/marketer-pro-contract";
import type { BrandIntelligenceProfile } from "@home-link/marketer-pro-contract";

export type BrandContext = {
  brandName: string;
  industryVertical?: string;
  tagline?: string;
  slogans: string[];
  themes: string[];
  preferredPhrases: string[];
  bannedPhrases: string[];
  persona?: string;
  audienceName?: string;
  audienceDescription?: string;
  primaryHex?: string;
  accentHex?: string;
  logoUrl?: string;
  websiteUrl?: string;
};

export function buildBrandContext(
  branding: WorkspaceBranding,
  profile?: BrandIntelligenceProfile | null,
): BrandContext {
  const voice = profile?.voice;
  const defaultAudienceId = profile?.defaultAudienceId;
  const audience = defaultAudienceId
    ? (profile?.audiences ?? []).find((a) => a.audienceId === defaultAudienceId)
    : (profile?.audiences ?? [])[0];

  return {
    brandName: branding.displayName ?? profile?.displayName ?? "Your Brand",
    industryVertical: branding.industryVertical,
    tagline: branding.tagline,
    slogans: branding.slogans ?? [],
    themes: branding.themes ?? [],
    preferredPhrases: voice?.preferredPhrases ?? [],
    bannedPhrases: voice?.bannedPhrases ?? [],
    persona: voice?.persona,
    audienceName: audience?.name,
    audienceDescription: audience?.description,
    primaryHex: branding.primaryHex,
    accentHex: branding.accentHex,
    logoUrl: branding.logoUrl,
    websiteUrl: branding.websiteUrl,
  };
}

/**
 * Serializes brand context into a prompt block for injection into any AI prompt.
 * Produces a tightly-scoped block — no redundant lines if fields are absent.
 */
export function brandContextToPromptBlock(ctx: BrandContext): string {
  const lines: string[] = ["=== BRAND CONTEXT ==="];

  lines.push(`Brand: ${ctx.brandName}`);

  if (ctx.industryVertical) {
    lines.push(`Industry: ${ctx.industryVertical}`);
  }

  if (ctx.tagline) {
    lines.push(`Tagline: "${ctx.tagline}"`);
  }

  if (ctx.slogans.length > 0) {
    lines.push(`Slogans: ${ctx.slogans.map((s) => `"${s}"`).join(" | ")}`);
  }

  if (ctx.themes.length > 0) {
    lines.push(`Brand themes / values: ${ctx.themes.join(", ")}`);
  }

  if (ctx.persona) {
    lines.push(`Brand voice: ${ctx.persona}`);
  }

  if (ctx.preferredPhrases.length > 0) {
    lines.push(`Preferred phrases: ${ctx.preferredPhrases.slice(0, 8).join(", ")}`);
  }

  if (ctx.bannedPhrases.length > 0) {
    lines.push(`Banned phrases (never use): ${ctx.bannedPhrases.slice(0, 8).join(", ")}`);
  }

  if (ctx.audienceName) {
    lines.push(
      ctx.audienceDescription
        ? `Target audience: ${ctx.audienceName} — ${ctx.audienceDescription}`
        : `Target audience: ${ctx.audienceName}`,
    );
  }

  if (ctx.primaryHex) {
    lines.push(`Brand primary color: ${ctx.primaryHex}`);
  }

  if (ctx.websiteUrl) {
    lines.push(`Website: ${ctx.websiteUrl}`);
  }

  lines.push("===================");
  return lines.join("\n");
}

/**
 * Industry-to-ad-style mapping: suggests visual/copy direction based on business category.
 * Used to inject category-appropriate generation guidance automatically.
 */
const INDUSTRY_AD_GUIDANCE: Record<string, string> = {
  // Retail & Fashion
  fashion: "Lifestyle photography, aspirational imagery, clean white or neutral backgrounds, models wearing products.",
  apparel: "Lifestyle photography, aspirational imagery, clean white or neutral backgrounds, models wearing products.",
  retail: "Product-forward imagery, clean backgrounds, prominent product placement, clear value props.",
  ecommerce: "Product-forward imagery, clean backgrounds, prominent product placement, clear value props.",
  // Food & Beverage
  restaurant: "Warm food photography, vibrant colors, close-up texture shots, inviting atmosphere.",
  food: "Warm food photography, vibrant colors, close-up texture shots, inviting atmosphere.",
  beverage: "Refreshing visuals, condensation on glass, vibrant liquid colors, lifestyle drinking moments.",
  // Health & Fitness
  fitness: "High-energy, dynamic action shots, inspirational copy, before/after concepts, strong typography.",
  wellness: "Calm, serene imagery, soft tones, natural elements, clean minimalist design.",
  health: "Clinical yet warm, trust-building imagery, diverse representation, clean professional layout.",
  // Technology
  saas: "Clean UI screenshots, minimalist design, productivity imagery, professional office environments.",
  technology: "Clean UI screenshots, minimalist design, productivity imagery, professional office environments.",
  software: "Clean UI screenshots, minimalist design, productivity imagery, professional office environments.",
  startup: "Bold, disruptive visuals, vibrant gradient backgrounds, forward-looking imagery.",
  // Finance
  finance: "Professional, trust-building imagery, clean data visualizations, confident business people.",
  fintech: "Professional, trust-building imagery, clean data visualizations, confident business people.",
  // Real Estate
  "real estate": "Property showcase, professional photography, aspirational lifestyle imagery.",
  // Beauty
  beauty: "Glamour photography, close-up detail shots, luxurious textures, vibrant product colors.",
  cosmetics: "Glamour photography, close-up detail shots, luxurious textures, vibrant product colors.",
  // Education
  education: "Bright, optimistic imagery, diverse students, learning environments, achievement moments.",
  edtech: "Digital learning visuals, interface screenshots, diverse students, progress imagery.",
  // B2B
  b2b: "Professional environments, handshakes, data-driven graphics, team collaboration imagery.",
  consulting: "Professional environments, handshakes, data-driven graphics, team collaboration imagery.",
  // Entertainment
  entertainment: "Bold, energetic visuals, event photography, exciting moments, vibrant colors.",
  // Nonprofit
  nonprofit: "Authentic storytelling, human impact imagery, community moments, emotional connection.",
};

export function getIndustryAdGuidance(industryVertical?: string): string | undefined {
  if (!industryVertical) return undefined;
  const key = industryVertical.toLowerCase().trim();
  return (
    INDUSTRY_AD_GUIDANCE[key] ??
    Object.entries(INDUSTRY_AD_GUIDANCE).find(([k]) => key.includes(k))?.[1]
  );
}
