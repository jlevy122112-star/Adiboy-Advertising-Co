/**
 * MVP multi-platform post generation.
 * Each platform gets a full optimization spec: structure, tone, algorithm
 * signals, character budgets, and what to always/never do.
 * Anthropic → OpenAI → deterministic stub fallback.
 */

const REQUEST_TIMEOUT_MS = 60_000;

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
  // Full brand context — every field from the MVP brand profile
  brandName?: string;
  brandVoice?: string;       // 3 personality words
  brandColor?: string;
  businessType?: string;     // product | service | both
  industry?: string;
  problem?: string;          // customer pain the brand solves
  solution?: string;         // how the brand solves it
  outcome?: string;          // results customers get
  website?: string;
  phone?: string;
  contactEmail?: string;
  instagramHandle?: string;
  address?: string;
};

// ─── Full platform optimization spec ────────────────────────────────────────
// Every field here feeds directly into the AI prompt so the AI knows what
// "optimized" means per platform — not just the hard limit.

interface PlatformSpec {
  name: string;
  maxChars: number;
  optimalChars: string;
  maxHashtags: number;
  optimalHashtags: string;
  hashtagPlacement: string;
  structure: string;
  tone: string;
  algorithmSignals: string;
  mustInclude: string[];
  neverDo: string[];
  exampleHook: string;
}

const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  ig: {
    name: "Instagram",
    maxChars: 2200,
    optimalChars: "150–300 chars for feed posts; up to 2,200 for carousel or educational content",
    maxHashtags: 30,
    optimalHashtags: "5–10 highly relevant hashtags",
    hashtagPlacement: "Place hashtags at the very end of the caption after 3 line breaks, or put them in the first comment for cleaner presentation",
    structure: "LINE 1 (hook): Bold statement, question, or surprising fact — this is the only line visible before 'more'. LINE 2–4: Short punchy paragraphs with line breaks between each. LAST LINE: Clear CTA (save this, comment below, link in bio). HASHTAGS: After a gap.",
    tone: "Conversational, authentic, visually descriptive, emotionally resonant. Write like a real human who loves what they do, not a corporate press release.",
    algorithmSignals: "Instagram rewards: saves (include educational value or lists worth bookmarking), shares (relatable/useful), comments (ask a specific question). Reels captions should be ultra-short (under 100 chars) and match video energy. Carousel captions should start with 'Swipe →' or similar.",
    mustInclude: [
      "A scroll-stopping first line (the hook)",
      "At least one line break between paragraphs for readability",
      "A question or prompt to drive comments",
      "One clear CTA (save, share, link in bio)",
      "1–3 relevant emojis woven into the text naturally — not at the start of every line",
    ],
    neverDo: [
      "Never start with the brand name",
      "Never use hashtags inline in the body copy",
      "Never write one giant wall of text — use line breaks",
      "Never use generic hashtags like #love #instagood",
      "Never end without a CTA",
    ],
    exampleHook: "The thing nobody tells you about [topic] is…",
  },

  li: {
    name: "LinkedIn",
    maxChars: 3000,
    optimalChars: "1,000–1,900 chars for maximum reach — long enough to show expertise, short enough to read in 60 seconds",
    maxHashtags: 5,
    optimalHashtags: "3–5 targeted professional hashtags",
    hashtagPlacement: "Add hashtags at the very bottom of the post, on their own line, after the main content",
    structure: "LINE 1 (hook): Bold, specific, curiosity-driving opener. NO PREAMBLE. BODY: 3–5 short paragraphs, each 2–3 sentences. Use line breaks between every paragraph. Include a personal insight, lesson learned, or counter-intuitive take. CLOSING: Summary statement + direct CTA (comment, share, follow). HASHTAGS: Below the CTA.",
    tone: "Professional but human. First-person storytelling. Share opinions, lessons, results, or frameworks. Thought leadership > corporate speak. Never sound like a press release. Business owners should sound like themselves, not their company.",
    algorithmSignals: "LinkedIn algorithm rewards: comments most (ask a specific question to drive discussion), dwell time (make the post worth reading to the end), saves. The first 90 minutes of engagement heavily weight distribution. Posting Tue–Thu 8–10am or 12–1pm consistently outperforms other windows.",
    mustInclude: [
      "A specific, bold opening line that creates curiosity — do NOT start with 'Excited to share'",
      "One personal insight, data point, or counter-intuitive perspective",
      "Blank lines between every paragraph for scanability",
      "A direct question at the end to drive comments",
      "Hashtags appropriate to the professional topic",
    ],
    neverDo: [
      "Never open with 'Excited to announce' or 'I'm thrilled to share'",
      "Never use more than 5 hashtags",
      "Never write a wall of text — paragraph breaks are mandatory",
      "Never be vague — use specific numbers, results, or examples",
      "Never include external links in the post body (add in comments to protect reach)",
    ],
    exampleHook: "I made a mistake that cost us [X]. Here's exactly what I learned:",
  },

  x: {
    name: "X (Twitter)",
    maxChars: 280,
    optimalChars: "200–260 chars — leave room for replies and retweet context",
    maxHashtags: 2,
    optimalHashtags: "1–2 hashtags maximum — only if they add discovery value",
    hashtagPlacement: "1 hashtag inline if it replaces a word naturally, or 1–2 at the end. No hashtag stuffing.",
    structure: "HOOK (the whole tweet IS the hook): Lead with the most compelling idea. State the opinion, insight, or hook in the first 15 words. Then add context or proof in the next sentence. End with a punchy CTA or provocative question. If content needs more room, indicate it's a thread with '🧵' or '1/'.",
    tone: "Bold, direct, opinionated. Hot takes, specific insights, and contrarian perspectives outperform neutral statements. Write like a smart person texting a friend, not a marketing department. Short sentences. Active voice only.",
    algorithmSignals: "X rewards: replies (ask bold questions), retweets (make it shareable/quotable), bookmarks (give real value). Threads perform well for educational content. First tweet in a thread must be the hook. Avoid links in main tweet (kills reach) — add in reply instead.",
    mustInclude: [
      "An ultra-tight, punchy first sentence — this IS the whole post",
      "A specific claim, stat, or insight — not a generic observation",
      "Maximum 2 sentences before the CTA",
      "Action-oriented last line: ask a question, make a bold statement, or give a clear CTA",
    ],
    neverDo: [
      "Never exceed 280 characters",
      "Never use more than 2 hashtags",
      "Never start with 'Hey everyone' or 'I wanted to share'",
      "Never be passive or wishy-washy — X rewards conviction",
      "Never include a link in the main tweet if reach matters (add as reply instead)",
    ],
    exampleHook: "Hot take: [controversial truth about topic]. Here's why →",
  },

  fb: {
    name: "Facebook",
    maxChars: 63206,
    optimalChars: "80–250 chars for organic posts (shorter = more reach); 400–1,000 chars for educational or promotional posts with link preview",
    maxHashtags: 30,
    optimalHashtags: "2–5 hashtags, or none for pure organic reach",
    hashtagPlacement: "Inline or at the end — Facebook hashtags are optional and often omitted for better reach",
    structure: "OPENING (first 500 chars shown before 'See More'): Lead with a question, bold statement, or relatable hook. BODY: Friendly, community-first tone. Use 'you' and 'we' language. Break into short paragraphs. Include value (tip, story, behind-the-scenes). CLOSING: Specific engagement question + CTA. If linking: put the link at the end, after the CTA.",
    tone: "Warm, community-focused, conversational. Facebook is for building connection, not broadcasting. Write like you're posting to your closest customers. Personal stories, behind-the-scenes content, and community questions outperform promotional content.",
    algorithmSignals: "Facebook rewards: comments (especially long ones), shares, reactions (love/care outweigh like). Ask specific, answerable questions at the end. Video and photo posts get more reach than link posts. Going Live signals quality. Native video always beats linked YouTube.",
    mustInclude: [
      "A relatable or attention-grabbing opening line",
      "Community-facing language — 'we', 'you', 'our community'",
      "A specific question that's easy to answer in a comment",
      "Visual description (what image or video would accompany this)",
      "CTA matched to goal: comment, share, click, or DM",
    ],
    neverDo: [
      "Never ask people to 'like and share' directly (engagement bait is penalized)",
      "Never write a wall of text — use line breaks and short paragraphs",
      "Never be purely promotional without giving value first",
      "Never use too many emojis — 2–4 max for professionalism",
      "Never link to external sites in the post body if reach matters",
    ],
    exampleHook: "We asked 100 [audience type] this question. The answers surprised us.",
  },

  tt: {
    name: "TikTok",
    maxChars: 2200,
    optimalChars: "Caption: 50–150 chars (TikTok is a video platform — the caption supports the video). Video script brief: 150–300 words describing what to say/show",
    maxHashtags: 20,
    optimalHashtags: "3–6 hashtags: 1 mega trending + 2–3 niche + 1–2 topic-specific",
    hashtagPlacement: "Hashtags at the end of the caption — they serve discovery in TikTok's algorithm",
    structure: "CAPTION (ultra-short): 1–2 sentences max that either tease what the video is about, add context, or include a CTA like 'POV:', 'Wait for it...', 'This changed everything about [topic]'. VIDEO SCRIPT BRIEF: Describe the 3-second hook (what the opening 3 seconds show/say), the core content structure (show-don't-tell), and the closing hook/CTA. Keep it tight — TikTok videos 15–60 seconds perform best.",
    tone: "Raw, authentic, trend-aware, fast-paced. Gen-Z and Millennial audiences reward real over polished. Lean into trending formats: 'POV:', 'Things that just make sense:', 'The way I [did X]'. Use conversational, unscripted-sounding language. Humor and relatability win.",
    algorithmSignals: "TikTok algorithm rewards: watch time (hook in first 3 seconds is everything), shares (make it relatable or shareable), saves, comments. Niche hashtags outperform mega hashtags. Sounds/audio trend drives discovery — suggest trending audio direction. Post consistently for FYP distribution.",
    mustInclude: [
      "A 3-second video hook description — the absolute most critical element",
      "A short punchy caption that creates FOMO or curiosity",
      "At least one niche/specific hashtag related to the topic",
      "Trending format framing where relevant: POV, Story Time, Day in My Life, Tutorial",
      "CTA in the caption or script: 'comment [X] if...', 'duet this', 'save for later'",
    ],
    neverDo: [
      "Never write a long corporate caption — this is a video platform",
      "Never use only mega-popular hashtags (#fyp #foryou) — add niche ones",
      "Never ignore the 3-second hook — it determines if anyone watches",
      "Never sound scripted or polished — authenticity wins on TikTok",
      "Never forget a CTA to boost engagement (watch time + comments = distribution)",
    ],
    exampleHook: "POV: You just discovered [topic] and you can't unsee it",
  },

};

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(input: GeneratePostsInput): string {
  const platformSections = input.platforms
    .map((p) => {
      const spec = PLATFORM_SPECS[p];
      if (!spec) return `  - ${p}: Write an optimized post for this platform.`;

      return `
## ${spec.name} (platform code: "${p}")
- Character limit: ${spec.maxChars} | Optimal length: ${spec.optimalChars}
- Hashtags: ${spec.optimalHashtags} | Placement: ${spec.hashtagPlacement}
- Content structure: ${spec.structure}
- Tone: ${spec.tone}
- Algorithm optimization: ${spec.algorithmSignals}
- MUST include: ${spec.mustInclude.map((m) => `\n    ✓ ${m}`).join("")}
- NEVER do: ${spec.neverDo.map((n) => `\n    ✗ ${n}`).join("")}
- Example hook style: "${spec.exampleHook}"`;
    })
    .join("\n\n");

  const urgencyLine =
    input.urgency !== "Normal"
      ? `\nUrgency framing: ${input.urgency} — reflect this in the copy's energy and word choice.`
      : "";

  const hasBrand = [
    input.brandName, input.brandVoice, input.problem,
    input.solution, input.outcome, input.industry,
  ].some(Boolean);

  const brandSection = hasBrand
    ? `
## Brand Context — INJECT INTO EVERY POST (generic content is a product failure)
The AI must use these brand facts to make every post sound like THIS specific brand,
not a generic template. Reference the brand's specific problem, solution, and outcome
in the copy — not abstract marketing language.
${input.brandName       ? `- Brand name: ${input.brandName}` : ""}
${input.industry        ? `- Industry: ${input.industry}` : ""}
${input.businessType    ? `- Business type: ${input.businessType}` : ""}
${input.brandVoice      ? `- Brand personality (3 words): ${input.brandVoice} — every post must feel like these words. If the words say "bold, fun, irreverent" the copy should be bold, fun, and irreverent. Not safe. Not generic.` : ""}
${input.problem         ? `- Customer pain we solve: ${input.problem} — reference this pain in the copy to show we understand the audience` : ""}
${input.solution        ? `- Our solution: ${input.solution} — weave this in naturally, not as a sales pitch` : ""}
${input.outcome         ? `- What customers get: ${input.outcome} — use this as the emotional hook and benefit statement` : ""}
${input.website         ? `- Website: ${input.website}` : ""}
${input.phone           ? `- Phone: ${input.phone}` : ""}
${input.contactEmail    ? `- Email: ${input.contactEmail}` : ""}
${input.instagramHandle ? `- Instagram: @${input.instagramHandle.replace(/^@/, "")}` : ""}
${input.address         ? `- Location: ${input.address}` : ""}
`
    : "";

  return `You are an expert social media strategist and copywriter who writes fully optimized, ready-to-publish content. You never write generic or template-sounding copy — every post is crafted to maximize reach, engagement, and conversion on its specific platform.

## Campaign Brief
- Topic / tagline: ${input.topic}
- Content goal: ${input.contentGoal}
- Call to action: ${input.cta}
- Hashtag strategy: ${input.hashtagStrategy}${urgencyLine}
${brandSection}
## Platform Specifications and Optimization Requirements

You must follow every specification below exactly. Each platform has fundamentally different algorithms, audiences, and best practices. Apply ALL optimization rules — not just the character limit.
${platformSections}

## Output Format
Return a single JSON object. Keys are the platform codes (${input.platforms.join(", ")}).
Each value is: { "content": "the full post text (NO hashtags here)", "hashtags": ["hashtag1", "hashtag2"] }

Rules:
- "content" must be the complete, publish-ready post following that platform's structure exactly
- "hashtags" must be an array of strings WITHOUT the # symbol
- Apply all MUST INCLUDE rules — do not skip any
- Apply all NEVER DO rules — violating these is a failure
- Write for real humans on that platform, not for a generic audience
- If content has structure (like a TikTok script brief), include it fully in "content"

Output ONLY the JSON object. No markdown fences. No preamble. No explanation.`;
}

// ─── Stub fallback ───────────────────────────────────────────────────────────

function stubPost(platform: string, input: GeneratePostsInput): PlatformPost {
  const brand = input.brandName ? `${input.brandName}: ` : "";
  const stubs: Record<string, string> = {
    ig: `The thing nobody tells you about ${input.topic} 👇\n\nMost people get this completely wrong.\n\nHere's what actually works:\n\n→ ${input.cta}\n\nSave this post if it was helpful. What's your biggest challenge with this? Drop it in the comments 👇`,
    li: `Here's something most people in this industry overlook about ${input.topic}.\n\nI've seen businesses struggle with this repeatedly — and the fix is simpler than you'd think.\n\n${brand}${input.cta}.\n\nWhat's your experience been? I'd love to hear your perspective in the comments.\n\n${input.contentGoal}`,
    x: `${input.topic} is more powerful than most people realize.\n\n${input.cta}`,
    fb: `Hey everyone! 👋\n\nWe've been getting a lot of questions about ${input.topic} lately — and we want to share what we've learned.\n\n${input.cta}\n\nWhat questions do you have? Drop them in the comments and we'll answer every one!`,
    tt: `POV: You just found out about ${input.topic} and everything changes 🤯\n\nScript: Open with the #1 mistake people make → reveal the better way → show the result in under 30 seconds. End with: "${input.cta}"\n\n3-second hook: "[Shocking statement about topic]"`,
  };
  const content = stubs[platform] ?? `${input.topic} — ${input.cta}`;
  const tags = platform === "ig"
    ? ["marketing", "business", "entrepreneur"]
    : platform === "li"
    ? ["business", "leadership", "growth"]
    : platform === "tt"
    ? ["fyp", "viral", "business"]
    : ["marketing", "brand"];
  return { platform, content, charCount: content.length, hashtags: tags };
}

// ─── JSON parser ─────────────────────────────────────────────────────────────

function parseGeneratedJson(
  raw: string,
  platforms: string[],
  input: GeneratePostsInput,
): PlatformPost[] {
  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      { content: string; hashtags: string[] }
    >;
    return platforms.map((p) => {
      const entry = parsed[p];
      if (!entry?.content) return stubPost(p, input);
      const content = entry.content.trim();
      const hashtags = Array.isArray(entry.hashtags)
        ? entry.hashtags.map((h: string) =>
            h.startsWith("#") ? h : `#${h}`,
          )
        : [];
      return { platform: p, content, charCount: content.length, hashtags };
    });
  } catch {
    return platforms.map((p) => stubPost(p, input));
  }
}

// ─── AI providers ────────────────────────────────────────────────────────────

async function callAnthropic(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const body = JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
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
    const json = (await res.json()) as {
      content?: { type: string; text: string }[];
    };
    const block = json.content?.find((b) => b.type === "text");
    return block?.text?.trim() ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = (
    process.env.MARKETER_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY ??
    ""
  ).trim();
  if (!apiKey) return null;

  const baseUrl = (
    process.env.MARKETER_OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.MARKETER_GENERATION_MODEL ?? "gpt-4o-mini";

  const body = JSON.stringify({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are an expert social media strategist and copywriter. You write fully optimized, platform-native content that drives real engagement — not generic marketing copy.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 4096,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export async function generatePosts(
  input: GeneratePostsInput,
): Promise<PlatformPost[]> {
  if (!input.platforms.length) return [];

  const prompt = buildPrompt(input);
  const raw = (await callAnthropic(prompt)) ?? (await callOpenAI(prompt));

  if (!raw) {
    return input.platforms.map((p) => stubPost(p, input));
  }

  const cleaned = raw
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/```$/m, "")
    .trim();
  return parseGeneratedJson(cleaned, input.platforms, input);
}
