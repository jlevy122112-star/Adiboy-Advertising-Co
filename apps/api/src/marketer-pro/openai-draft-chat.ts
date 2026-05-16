/**
 * Minimal OpenAI Chat Completions client for generation drafts (no extra npm deps).
 * Includes a 30-second request timeout and one automatic retry on transient failures.
 */

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

export type OpenAiDraftChatParams = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly system: string;
  readonly user: string;
};

function extractChatCompletionContent(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const root = parsed as Record<string, unknown>;
  const choices = root.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0];
  if (typeof first !== "object" || first === null) {
    return null;
  }
  const message = (first as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) {
    return null;
  }
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (typeof part === "object" && part !== null && "text" in part) {
        const t = (part as { text?: unknown }).text;
        if (typeof t === "string") {
          parts.push(t);
        }
      }
    }
    return parts.length > 0 ? parts.join("") : null;
  }
  return null;
}

async function attemptOpenAiRequest(
  url: string,
  params: OpenAiDraftChatParams,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}: ${raw.slice(0, 800)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("OpenAI response was not valid JSON");
  }
  const text = extractChatCompletionContent(parsed);
  if (text == null || text.trim().length === 0) {
    throw new Error("OpenAI response missing assistant message content");
  }
  return text;
}

/** Returns true for transient failures worth retrying (network errors, 5xx). */
function isRetryable(err: unknown, status?: number): boolean {
  if (err instanceof DOMException && err.name === "AbortError") {
    return true; // timeout
  }
  if (status !== undefined && status >= 500) {
    return true;
  }
  return false;
}

export async function completeOpenAiDraftChat(
  params: OpenAiDraftChatParams,
): Promise<string> {
  const base = params.baseUrl.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptOpenAiRequest(url, params);
    } catch (err) {
      lastErr = err;
      const statusMatch =
        err instanceof Error ? /HTTP (\d{3})/.exec(err.message) : null;
      const status = statusMatch ? Number(statusMatch[1]) : undefined;
      // Don't retry on client errors (4xx) — they won't recover.
      if (!isRetryable(err, status) || attempt === MAX_ATTEMPTS) {
        break;
      }
    }
  }
  throw lastErr;
}
