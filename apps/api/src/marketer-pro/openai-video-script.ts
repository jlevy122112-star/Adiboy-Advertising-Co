/**
 * OpenAI chat completion → structured video script.
 * Uses gpt-4o with JSON mode for reliable structured output.
 */

import type { GenerationBrief } from "@home-link/marketer-pro-contract";
import type { VideoScene } from "@home-link/marketer-pro-contract";

export type VideoScriptGenResult =
  | { ok: true; title: string; scenes: VideoScene[]; hashtags: string[] }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `You are a short-form video scriptwriter. Given a marketing brief, generate a structured video script as JSON.

Return ONLY valid JSON matching this schema:
{
  "title": "string — catchy video title",
  "hashtags": ["string"],
  "scenes": [
    {
      "sceneNumber": 1,
      "imagePrompt": "DALL-E image generation prompt for this scene",
      "imageDescription": "brief human description of the visual",
      "voiceoverText": "what the narrator says",
      "captionText": "on-screen caption text (short, max 8 words)",
      "durationSeconds": 5
    }
  ]
}

Rules:
- 4-6 scenes total
- Each scene 4-7 seconds
- Total duration 20-40 seconds
- captionText max 8 words
- imagePrompt must be photorealistic, no text in image
- No markdown, no explanation, only JSON`;

export async function generateVideoScript(args: {
  apiKey: string;
  brief: GenerationBrief;
  platform: string;
  brandName?: string;
}): Promise<VideoScriptGenResult> {
  const { apiKey, brief, platform, brandName } = args;

  const headline = brief.copy?.headline ?? "";
  const body = brief.copy?.body ?? "";
  const mood = brief.design?.mood ?? "";
  const imageryDirection = brief.design?.imageryDirection ?? "";

  const userPrompt = [
    `Platform: ${platform}`,
    brandName ? `Brand: ${brandName}` : null,
    `Headline: ${headline}`,
    body ? `Body copy: ${body}` : null,
    mood ? `Mood: ${mood}` : null,
    imageryDirection ? `Visual direction: ${imageryDirection}` : null,
    `Create a short-form video script with 4-6 scenes.`,
  ].filter(Boolean).join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

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
        temperature: 0.7,
        max_tokens: 1500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `openai_error_${res.status}: ${body.slice(0, 200)}` };
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
