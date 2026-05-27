/**
 * MVP asset generation — DALL-E 3 images + AI video scripts per platform.
 *
 * Two separate exports:
 *   generateVideoScripts(input)  — fast, text-only, included in /api/generate response
 *   generateImages(input)        — slow (DALL-E 3, 30-60s), called from /api/generate-images
 *
 * Images use OpenAI-hosted URLs (60-min TTL). Upload to S3 before that window
 * when live publishing is implemented.
 *
 * Platform specs sourced from content-asset-formats.ts catalog + DALL-E 3 size constraints.
 * DALL-E 3 only supports three sizes: 1024×1024 | 1792×1024 | 1024×1792
 */

import type { GeneratePostsInput } from "./mvp-generate-posts.js";

const DALLE_URL = "https://api.openai.com/v1/images/generations";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_TIMEOUT_MS = 90_000;
const SCRIPT_TIMEOUT_MS = 30_000;

// ─── Platform asset specs (from content-asset-formats.ts catalog) ─────────────
// Each platform maps to: DALL-E size bucket, real pixel dimensions, format
// guidance for prompt injection, and whether a video script is generated.

interface PlatformAssetSpec {
  dalleSize: "1024x1024" | "1792x1024" | "1024x1792";
  realDimensions: string;   // actual pixel spec the post will be exported to
  aspectRatio: string;
  formatGuidance: string;   // platform-specific image composition rules
  needsVideoScript: boolean;
  videoStyle?: string;      // video platform style guidance for script generation
}

const PLATFORM_SPECS: Record<string, PlatformAssetSpec> = {
  ig: {
    dalleSize: "1024x1024",
    realDimensions: "1080×1080px",
    aspectRatio: "1:1 square",
    formatGuidance:
      "Instagram feed post: perfectly balanced square composition. Bold, saturated colors that pop in the feed. " +
      "Strong central subject with clean negative space. High-contrast, thumb-stopping. Works at small grid thumbnail scale. " +
      "Lifestyle or product-centric depending on brand. Premium photography aesthetic.",
    needsVideoScript: true,
    videoStyle:
      "Instagram Reels: Aesthetic and aspirational. Hook in 2 seconds. Smooth transitions. Story arc that resolves. " +
      "Save-worthy insight or transformation. 15-30 seconds total. Portrait 9:16 format.",
  },
  li: {
    dalleSize: "1792x1024",
    realDimensions: "1200×627px",
    aspectRatio: "1.91:1 landscape",
    formatGuidance:
      "LinkedIn sponsored post: professional, authority-building visual. Clean and credible. Business-appropriate. " +
      "Conveys expertise, trust, and competence. B2B audience — no gimmicks. Corporate or professional lifestyle setting. " +
      "Muted, sophisticated color palette. Data visualization or professional environment works well.",
    needsVideoScript: false,
  },
  x: {
    dalleSize: "1792x1024",
    realDimensions: "1200×675px",
    aspectRatio: "16:9 landscape",
    formatGuidance:
      "X/Twitter card image: bold, high-contrast visual that works at 504px wide thumbnail scale. " +
      "Clear, unambiguous focal point. Eye-catching enough to stop mid-scroll. " +
      "Punchy, direct composition. Strong contrast between subject and background.",
    needsVideoScript: false,
  },
  fb: {
    dalleSize: "1792x1024",
    realDimensions: "1200×630px",
    aspectRatio: "1.91:1 landscape",
    formatGuidance:
      "Facebook feed post: dominant visual in top two-thirds of frame. " +
      "Thumb-stopping within one second of scroll. Warm, community-friendly aesthetic. " +
      "Works alongside the link preview card format. Friendly, accessible visual language. " +
      "Slightly warmer and more approachable than LinkedIn.",
    needsVideoScript: false,
  },
  tt: {
    dalleSize: "1024x1792",
    realDimensions: "1080×1920px",
    aspectRatio: "9:16 vertical",
    formatGuidance:
      "TikTok thumbnail / video cover: full-bleed vertical. Authentic and energetic — not overly polished. " +
      "Clear visual hook that communicates the video topic instantly. Gen-Z aesthetic — real, raw, dynamic. " +
      "Bold action or expression in frame. High energy. Works with text overlays at top and bottom thirds.",
    needsVideoScript: true,
    videoStyle:
      "TikTok: Authentic over polished. Hook in 1.5 seconds. Trend-aware format. Fast-paced editing. " +
      "Relatable creator energy. Sound-on assumed. 15-45 seconds. Portrait 9:16.",
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type GeneratedImage = {
  platform: string;
  url: string;
  realDimensions: string;
  aspectRatio: string;
  aspectLabel: string;
  prompt: string;
};

export type VideoScene = {
  sceneNumber: number;
  imageDescription: string;
  voiceoverText: string;
  captionText: string;
  durationSeconds: number;
};

export type GeneratedVideoScript = {
  platform: string;
  title: string;
  scenes: VideoScene[];
  hashtags: string[];
  totalDurationSeconds: number;
};

// ─── Image prompt builder ─────────────────────────────────────────────────────

function buildImagePrompt(input: GeneratePostsInput, spec: PlatformAssetSpec): string {
  const parts: string[] = [
    `Create a professional advertising image for: "${input.topic.trim()}".`,
  ];

  if (input.brandName)  parts.push(`Brand: ${input.brandName}.`);
  if (input.industry)   parts.push(`Industry: ${input.industry}.`);
  if (input.brandVoice) parts.push(`Brand personality: ${input.brandVoice} — the visual must feel like these words.`);
  if (input.brandColor) parts.push(`Primary brand color: ${input.brandColor}. Incorporate this color prominently and intentionally.`);
  if (input.solution)   parts.push(`Product/service being advertised: ${input.solution}.`);
  if (input.outcome)    parts.push(`Emotional outcome to convey: ${input.outcome}.`);

  parts.push(spec.formatGuidance);

  parts.push(
    "Quality requirements: Professional advertising campaign quality — not stock photography. " +
    "Intentional lighting, color grading, and composition. Premium, polished aesthetic. " +
    "Photorealistic unless brand personality calls for illustration. " +
    "No text, logos, watermarks, or overlays in the image. " +
    "No generic clip-art or obvious AI tells. Shot as if by a top commercial photographer.",
  );

  return parts.join(" ");
}

// ─── DALL-E 3 image call ──────────────────────────────────────────────────────

async function callDalle3(
  apiKey: string,
  prompt: string,
  size: PlatformAssetSpec["dalleSize"],
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const res = await fetch(DALLE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        quality: "standard",
        response_format: "url",   // OpenAI-hosted URL, 60-min TTL
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { url?: string }[] };
    return json.data?.[0]?.url ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Video script generation ──────────────────────────────────────────────────

async function callVideoScript(
  apiKey: string,
  input: GeneratePostsInput,
  platform: string,
  videoStyle: string,
): Promise<GeneratedVideoScript | null> {
  const brandLines = [
    input.brandName  && `Brand: ${input.brandName}`,
    input.brandVoice && `Voice/personality: ${input.brandVoice}`,
    input.industry   && `Industry: ${input.industry}`,
    input.problem    && `Customer pain point: ${input.problem}`,
    input.solution   && `Our solution: ${input.solution}`,
    input.outcome    && `Customer outcome: ${input.outcome}`,
    input.website    && `Website: ${input.website}`,
  ].filter(Boolean).join("\n");

  const prompt = `Write a short-form video ad script.

Campaign:
- Topic: ${input.topic}
- Goal: ${input.contentGoal}
- CTA: ${input.cta}
- Urgency: ${input.urgency}
- Platform style: ${videoStyle}

${brandLines ? `Brand context:\n${brandLines}` : ""}

Return ONLY valid JSON — no markdown, no explanation:
{
  "title": "compelling video title for this platform",
  "hashtags": ["8-12 hashtags without # symbol — mix trending + topic-specific"],
  "scenes": [
    {
      "sceneNumber": 1,
      "imageDescription": "Detailed visual description — what the viewer sees. Specific, cinematic, professional ad quality.",
      "voiceoverText": "Exact words spoken. Matches brand voice. Conversational, not corporate.",
      "captionText": "Bold on-screen text — max 7 words, high impact",
      "durationSeconds": 4
    }
  ]
}

Rules: 4-6 scenes. Each 3-7 seconds. Hook in scene 1 (stops the scroll in 1.5s). CTA in final scene.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRIPT_TIMEOUT_MS);
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a senior advertising creative director writing high-performance short-form video scripts. Every script has a scroll-stopping hook, problem/solution arc, and clear CTA. Brand voice is non-negotiable." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { title?: string; hashtags?: unknown[]; scenes?: VideoScene[] };
    const scenes: VideoScene[] = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    return {
      platform,
      title: typeof parsed.title === "string" ? parsed.title : input.topic,
      scenes,
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map((h) => String(h).replace(/^#/, ""))
        : [],
      totalDurationSeconds: scenes.reduce((s, sc) => s + (sc.durationSeconds ?? 5), 0),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fast — text-only video scripts. Included in POST /api/generate response. */
export async function generateVideoScripts(
  input: GeneratePostsInput,
): Promise<GeneratedVideoScript[]> {
  const apiKey = (process.env.MARKETER_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return [];

  const videoPlatforms = input.platforms.filter(
    (p) => PLATFORM_SPECS[p]?.needsVideoScript,
  );

  const results = await Promise.allSettled(
    videoPlatforms.map((p) =>
      callVideoScript(apiKey, input, p, PLATFORM_SPECS[p]!.videoStyle ?? ""),
    ),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<GeneratedVideoScript> =>
      r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);
}

/** Slow — DALL-E 3 images (30-60s). Called from POST /api/generate-images. */
export async function generateImages(
  input: GeneratePostsInput,
): Promise<GeneratedImage[]> {
  const apiKey = (process.env.MARKETER_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return [];

  const results = await Promise.allSettled(
    input.platforms
      .filter((p) => PLATFORM_SPECS[p])
      .map(async (p): Promise<GeneratedImage | null> => {
        const spec = PLATFORM_SPECS[p]!;
        const prompt = buildImagePrompt(input, spec);
        const url = await callDalle3(apiKey, prompt, spec.dalleSize);
        if (!url) return null;
        return {
          platform: p,
          url,
          realDimensions: spec.realDimensions,
          aspectRatio: spec.aspectRatio,
          aspectLabel: `${spec.realDimensions} (${spec.aspectRatio})`,
          prompt,
        };
      }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<GeneratedImage> =>
      r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);
}
