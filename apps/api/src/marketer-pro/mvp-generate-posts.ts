/**
 * MVP multi-platform post generation.
 * Calls OpenAI (or Anthropic if key present) to generate platform-tuned copy.
 * Falls back to deterministic stubs when no key is configured.
 */

const REQUEST_TIMEOUT_MS = 45_000;

export type PlatformPost = {
  platform: string;
  content: string;
  charCount: number;
  hashtags: string[];
};

export type GeneratePostsInput = {
  platforms: string[];
  topic: string;
  contentGoal: string;
  cta: string;
  hashtagStrategy: string;
  urgency: string;
  brandName?: string;
  brandVoice?: string;
};

const PLATFORM_RULES: Record<string, string> = {
  ig: "Instagram (2,200 char max). Conversational, visual storytelling, 5–10 hashtags on a new line.",
  li: "LinkedIn (3,000 char max). Professional tone, insights-led, 2–3 hashtags inline.",
  x: "X / Twitter (280 char max). Punchy, hook-first, 1–2 hashtags, no filler.",
  fb: "Facebook (63,206 char max). Friendly, community feel, 2–4 hashtags.",
  tt: "TikTok caption (150 char max). Trend-aware, Gen-Z tone, 3–5 hashtags.",
  yt: "YouTube description (5,000 char max, first 125 chars are the hook). SEO-friendly, timestamps pattern, 3–5 hashtags.",
};

function buildPrompt(input: GeneratePostsInput): string {
  const platformLines = input.platforms
    .map((p) => `  - ${PLATFORM_RULES[p] ?? p}`)
    .join("\n");

  const urgencyLine = input.urgency !== "Normal" ? `\nUrgency framing: ${input.urgency}` : "";

  return `You are an expert social media copywriter. Write ready-to-publish posts for these platforms:
${platformLines}

Campaign details:
- Topic/tagline: ${input.topic}
- Content goal: ${input.contentGoal}
- Call to action: ${input.cta}
- Hashtag strategy: ${input.hashtagStrategy}${urgencyLine}
${input.brandName ? `- Brand: ${input.brandName}` : ""}
${input.brandVoice ? `- Voice/personality: ${input.brandVoice}` : ""}

Return a JSON object with a key for each platform code (${input.platforms.join(", ")}).
Each value must be an object: { "content": "...", "hashtags": ["...", ...] }
The content should NOT include the hashtags (those go in the hashtags array).
Output ONLY the JSON object, no markdown fences, no preamble.`;
}

function stubPost(platform: string, input: GeneratePostsInput): PlatformPost {
  const stubs: Record<string, string> = {
    ig: `✨ ${input.topic}\n\nWe're thrilled to share this with you — ${input.cta.toLowerCase()} today and be part of something amazing.`,
    li: `Excited to announce: ${input.topic}.\n\nThis represents a meaningful milestone for our team. ${input.cta}.`,
    x: `🚀 ${input.topic} — ${input.cta}`,
    fb: `Hey everyone! 👋 ${input.topic}. ${input.cta} — link in the comments!`,
    tt: `${input.topic} 🔥 ${input.cta}`,
    yt: `${input.topic}\n\n${input.cta}\n\nTimestamps:\n0:00 Introduction\n\n#${input.contentGoal.replace(/\s+/g, "")}`,
  };
  const content = stubs[platform] ?? `${input.topic} — ${input.cta}`;
  const tags = ["#Marketing", "#Brand", "#Growth"].slice(0, 3);
  return { platform, content, charCount: content.length, hashtags: tags };
}

function parseGeneratedJson(raw: string, platforms: string[], input: GeneratePostsInput): PlatformPost[] {
  try {
    const parsed = JSON.parse(raw) as Record<string, { content: string; hashtags: string[] }>;
    return platforms.map((p) => {
      const entry = parsed[p];
      if (!entry?.content) return stubPost(p, input);
      const content = entry.content.trim();
      const hashtags = Array.isArray(entry.hashtags)
        ? entry.hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`))
        : [];
      return { platform: p, content, charCount: content.length, hashtags };
    });
  } catch {
    return platforms.map((p) => stubPost(p, input));
  }
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = (process.env.MARKETER_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return null;

  const baseUrl = (process.env.MARKETER_OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.MARKETER_GENERATION_MODEL ?? "gpt-4o-mini";

  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: "You are an expert social media copywriter." },
      { role: "user", content: prompt },
    ],
    temperature: 0.75,
    max_tokens: 2000,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function callAnthropic(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const body = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as { content?: { type: string; text: string }[] };
    const block = json.content?.find((b) => b.type === "text");
    return block?.text?.trim() ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function generatePosts(input: GeneratePostsInput): Promise<PlatformPost[]> {
  if (!input.platforms.length) return [];

  const prompt = buildPrompt(input);

  const raw = (await callAnthropic(prompt)) ?? (await callOpenAI(prompt));

  if (!raw) {
    return input.platforms.map((p) => stubPost(p, input));
  }

  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/```$/m, "").trim();
  return parseGeneratedJson(cleaned, input.platforms, input);
}
