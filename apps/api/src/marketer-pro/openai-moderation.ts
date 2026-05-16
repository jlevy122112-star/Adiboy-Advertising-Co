/**
 * OpenAI Moderation API — checks text (prompt or generated content) for policy violations.
 * POST https://api.openai.com/v1/moderations
 */

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const REQUEST_TIMEOUT_MS = 15_000;

export type ModerationResult =
  | { ok: true; flagged: boolean; categories: Record<string, boolean> }
  | { ok: false; error: string };

type ModerationResponse = {
  results?: { flagged: boolean; categories: Record<string, boolean> }[];
  error?: { message: string };
};

export async function moderateText(
  apiKey: string,
  input: string,
): Promise<ModerationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(MODERATION_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });

    const raw = (await res.json().catch(() => ({}))) as ModerationResponse;

    if (!res.ok || raw.error) {
      return { ok: false, error: raw.error?.message ?? `http_${res.status}` };
    }

    const result = raw.results?.[0];
    if (!result) {
      return { ok: false, error: "moderation_missing_result" };
    }

    return { ok: true, flagged: result.flagged, categories: result.categories };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `moderation_fetch_error:${msg.slice(0, 200)}` };
  } finally {
    clearTimeout(timer);
  }
}
