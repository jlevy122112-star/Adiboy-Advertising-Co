/**
 * OpenAI Text-to-Speech for video voiceover.
 * Returns MP3 buffer or error.
 */

export type TtsResult =
  | { ok: true; buffer: Buffer; durationHint: number }
  | { ok: false; error: string };

export async function generateVoiceover(args: {
  apiKey: string;
  text: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
}): Promise<TtsResult> {
  const { apiKey, text, voice = "nova" } = args;

  if (!text.trim()) return { ok: false, error: "tts_empty_text" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text.slice(0, 4096),
        voice,
        response_format: "mp3",
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { ok: false, error: `tts_error_${res.status}: ${errBody.slice(0, 200)}` };
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    // rough estimate: ~150 words/minute
    const wordCount = text.split(/\s+/).length;
    const durationHint = Math.ceil((wordCount / 150) * 60);

    return { ok: true, buffer, durationHint };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) return { ok: false, error: "tts_timeout" };
    return { ok: false, error: `tts_fetch_error: ${msg.slice(0, 100)}` };
  }
}
