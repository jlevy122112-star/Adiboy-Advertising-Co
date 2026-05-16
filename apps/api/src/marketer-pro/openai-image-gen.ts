/**
 * DALL-E 3 image generation client.
 * POST https://api.openai.com/v1/images/generations
 * Returns base64-encoded PNG + the (possibly revised) prompt.
 */

import type { DallE3Size } from "./image-dimensions.js";

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const REQUEST_TIMEOUT_MS = 90_000; // DALL-E 3 can be slow

export type ImageGenResult =
  | { ok: true; b64: string; revisedPrompt: string }
  | { ok: false; error: string };

type DalleResponse = {
  data?: { b64_json?: string; revised_prompt?: string }[];
  error?: { message: string };
};

export async function generateImageWithDalle(opts: {
  apiKey: string;
  prompt: string;
  size: DallE3Size;
  quality?: "standard" | "hd";
}): Promise<ImageGenResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: opts.prompt,
        n: 1,
        size: opts.size,
        quality: opts.quality ?? "standard",
        response_format: "b64_json",
      }),
    });

    const raw = (await res.json().catch(() => ({}))) as DalleResponse;

    if (!res.ok || raw.error) {
      return { ok: false, error: raw.error?.message ?? `http_${res.status}` };
    }

    const item = raw.data?.[0];
    if (!item?.b64_json) {
      return { ok: false, error: "dalle_missing_b64_response" };
    }

    return {
      ok: true,
      b64: item.b64_json,
      revisedPrompt: item.revised_prompt ?? opts.prompt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `dalle_fetch_error:${msg.slice(0, 200)}` };
  } finally {
    clearTimeout(timer);
  }
}
