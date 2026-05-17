/**
 * OpenAI chat completion → structured video script.
 * Enterprise advertising quality — brand-voice, platform-native, conversion-optimized.
 */

import type { GenerationBrief } from "@home-link/marketer-pro-contract";
import type { VideoScene } from "@home-link/marketer-pro-contract";
import type { BrandContext } from "./brand-context-builder.js";
import { brandContextToPromptBlock, getIndustryAdGuidance } from "./brand-context-builder.js";

export type VideoScriptGenResult =
  | { ok: true; title: string; scenes: VideoScene[]; hashtags: string[] }
  | { ok: false; error: string };

const BASE_SYSTEM_PROMPT = `You are a senior advertising creative director and scriptwriter specializing in high-performance short-form video ads for global brands.

Your scripts are used by real businesses to advertise on TikTok, Instagram Reels, YouTube Shorts, and other social video platforms. They must meet enterprise advertising standards.

SCRIPT REQUIREMENTS:
- Hook: First 2-3 seconds must STOP the scroll. Use a bold statement, surprising visual, question, or dramatic moment.
- Problem/Solution arc: Quickly establish pain point → present solution → show transformation.
- CTA: Every script ends with a clear, platform-appropriate call to action.
- Brand voice: Mirror the exact brand personality provided. Never sound generic.
- Slogans: Weave in the brand's taglines and key phrases naturally — do NOT just append them.
- Visual storytelling: Each scene image prompt must look like a professional ad shoot, not a stock photo.

SCENE IMAGE PROMPTS:
- Write DALL-E 3 prompts that produce professional ad-quality visuals.
- Reference the brand's industry style, color palette, and aesthetic.
- Be specific: lighting, composition, subject, mood — every detail matters.
- No text in images (text is handled separately).

Return ONLY valid JSON matching this schema:
{
  "title": "string — compelling video title for the platform (not clickbait, genuinely useful)",
  "hashtags": ["string — trending + branded, 8-12 total"],
  "scenes": [
    {
      "sceneNumber": 1,
      "imagePrompt": "Detailed DALL-E 3 prompt for this specific scene — professional ad quality",
      "imageDescription": "Brief description of what viewer sees",
      "voiceoverText": "What the narrator says — matches brand voice and persona",
      "captionText": "Bold on-screen caption (max 7 words, high impact)",
      "durationSeconds": 5
    }
  ]
}

Rules:
- 4-6 scenes total
- Each scene 3-7 seconds
- Total duration 18-40 seconds
- captionText max 7 words, high impact
- No markdown, no explanation, ONLY valid JSON`;

const PLATFORM_GUIDANCE: Record<string, string> = {
  tiktok: "TikTok: Hook in 1.5 seconds. Authenticity over polish. Native-feeling. Trending audio context. Fast cuts. Relatable creator energy.",
  reels: "Instagram Reels: Aesthetic + aspirational. Smooth transitions. Polished but approachable. Story arc that completes. Save-worthy insight.",
  shorts: "YouTube Shorts: Educational hook ('Did you know…', '3 ways to…'). Value-dense. Subscribe mention natural. Professional production feel.",
  generic_vertical: "Vertical video: Bold visuals, fast pacing, CTA at bottom. Universal appeal.",
  generic_landscape: "Landscape: TV-commercial quality. Broader audience. Cinematic feel. Classic advertising structure.",
};

export async function generateVideoScript(args: {
  apiKey: string;
  brief: GenerationBrief;
  platform: string;
  brandName?: string;
  brand?: BrandContext;
  customTagline?: string;
  customCta?: string;
}): Promise<VideoScriptGenResult> {
  const { apiKey, brief, platform, brand, customTagline, customCta } = args;

  const headline = brief.copy?.headline ?? "";
  const body = brief.copy?.body ?? "";
  const cta = customCta ?? brief.copy?.cta ?? "";
  const mood = brief.design?.mood ?? "";
  const imageryDirection = brief.design?.imageryDirection ?? "";

  const brandName = brand?.brandName ?? args.brandName ?? "";
  const industryVertical = brand?.industryVertical;
  const industryGuidance = getIndustryAdGuidance(industryVertical);

  const userPromptParts: string[] = [];

  if (brand) {
    userPromptParts.push(brandContextToPromptBlock(brand));
  } else if (brandName) {
    userPromptParts.push(`Brand: ${brandName}`);
  }

  userPromptParts.push(`\nPLATFORM: ${PLATFORM_GUIDANCE[platform] ?? platform}`);

  if (industryGuidance) {
    userPromptParts.push(`\nINDUSTRY VISUAL STYLE: ${industryGuidance}`);
  }

  userPromptParts.push(`\nAD BRIEF:`);
  if (headline) userPromptParts.push(`Headline: ${headline}`);
  if (body) userPromptParts.push(`Body copy / context: ${body}`);
  if (cta) userPromptParts.push(`Call to action: ${cta}`);
  if (customTagline) userPromptParts.push(`Use this tagline in the script: "${customTagline}"`);
  if (mood) userPromptParts.push(`Mood: ${mood}`);
  if (imageryDirection) userPromptParts.push(`Visual direction: ${imageryDirection}`);

  userPromptParts.push(`\nGenerate a ${platform} video script with 4-6 scenes. Enterprise ad quality.`);

  const userPrompt = userPromptParts.join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.75,
        max_tokens: 2000,
        messages: [
          { role: "system", content: BASE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { ok: false, error: `openai_error_${res.status}: ${errBody.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      title?: string;
      scenes?: VideoScene[];
      hashtags?: string[];
    };

    if (!parsed.scenes?.length) {
      return { ok: false, error: "openai_no_scenes_returned" };
    }

    return {
      ok: true,
      title: parsed.title ?? headline,
      scenes: parsed.scenes,
      hashtags: parsed.hashtags ?? [],
    };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) return { ok: false, error: "openai_timeout" };
    return { ok: false, error: `openai_fetch_error: ${msg.slice(0, 100)}` };
  }
}
