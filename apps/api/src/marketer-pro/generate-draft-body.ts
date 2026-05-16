/**
 * Draft body from a {@link GenerationBrief}: OpenAI when configured, else
 * deterministic stub. {@link executeCreateGenerationDraft} awaits
 * {@link generateDraftBodyFromBrief}.
 */

import {
  labelContentGoal,
  stubContentGoalGuidance,
  type GenerationBrief,
} from "@home-link/marketer-pro-contract";

import { completeOpenAiDraftChat } from "./openai-draft-chat.js";

function linesForOptionalCopy(brief: GenerationBrief): string[] {
  const { copy } = brief;
  const out: string[] = [];
  const sub = copy.subhead?.trim();
  if (sub) {
    out.push(`Subhead: ${sub}`);
  }
  const body = copy.body?.trim();
  if (body) {
    const preview =
      body.length > 400 ? `${body.slice(0, 400)}.` : body;
    out.push("", "Body (preview):", preview);
  }
  const cta = copy.cta?.trim();
  if (cta) {
    out.push("", `CTA: ${cta}`);
  }
  const tags = copy.hashtags?.filter((t) => t.trim().length > 0) ?? [];
  if (tags.length > 0) {
    out.push("", `Hashtags: ${tags.slice(0, 12).join(" ")}`);
  }
  const link = copy.link?.trim();
  if (link) {
    out.push("", `Link: ${link}`);
  }
  return out;
}

function linesForVoice(brief: GenerationBrief): string[] {
  const v = brief.voice;
  if (!v) {
    return [];
  }
  const out: string[] = [""];
  if (v.toneShift) {
    out.push(`Voice tone shift: ${v.toneShift}`);
  }
  if (v.formalityOverride != null) {
    out.push(`Formality (1-5): ${v.formalityOverride}`);
  }
  const note = v.note?.trim();
  if (note) {
    out.push(`Voice note: ${note}`);
  }
  if (out.length === 1) {
    return [];
  }
  return out;
}

/**
 * Deterministic copy for human review when no model key is set or the model fails.
 */
export function buildStubDraftBodyFromBrief(
  brief: GenerationBrief,
  opts?: { brandContext?: string },
): string {
  const headline = brief.copy.headline?.trim() ?? "";
  const parts: string[] = [
    `Network: ${brief.network}`,
    `Format: ${brief.formatId}`,
    `Brief: ${brief.briefId}`,
    "",
    headline || "(no headline)",
  ];
  parts.push(...linesForOptionalCopy(brief));
  parts.push(...linesForVoice(brief));
  if (brief.contentGoal) {
    parts.push(
      "",
      `Content goal: ${labelContentGoal(brief.contentGoal)}`,
      ...stubContentGoalGuidance(brief.contentGoal).map((line) => `  - ${line}`),
    );
  }
  if (opts?.brandContext) {
    parts.push("", "-", "[Brand context would be injected into the model prompt.]");
  }
  parts.push(
    "",
    "-",
    "Stub draft (no OpenAI key configured, or model output was empty).",
  );
  return parts.join("\n");
}

function readOpenAiApiKey(): string | undefined {
  const a = process.env.MARKETER_OPENAI_API_KEY?.trim();
  if (a) {
    return a;
  }
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

function briefJsonForPrompt(brief: GenerationBrief): string {
  return JSON.stringify(brief, null, 2);
}

const SYSTEM_PROMPT = `You are a senior marketing copywriter for multi-network social and paid campaigns.
You receive a Marketer Pro "generation brief" as JSON: network, formatId, copy directives, optional voice/SEO/design hints, and optional contentGoal (Meta outcome style).
Write paste-ready primary copy the marketer can drop into the asset body (plain text). Respect the headline and any provided subhead/body/CTA/hashtags as anchors unless they clearly conflict with brand safety.
Do not wrap the answer in markdown code fences. No preamble—output only the copy.`;

/**
 * Model-backed body when `MARKETER_OPENAI_API_KEY` or `OPENAI_API_KEY` is set;
 * otherwise the deterministic stub from {@link buildStubDraftBodyFromBrief}.
 *
 * When `opts.brandContext` is provided (formatted by
 * `formatBrandGenerationContextForPrompt`), it is appended to the system
 * prompt so the model writes in the brand's voice.
 */
export async function generateDraftBodyFromBrief(
  brief: GenerationBrief,
  opts?: { brandContext?: string },
): Promise<string> {
  const apiKey = readOpenAiApiKey();
  if (!apiKey) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "generation_draft_no_api_key",
        message:
          "MARKETER_OPENAI_API_KEY / OPENAI_API_KEY not set — returning stub draft. Set the key to enable AI generation.",
        briefId: brief.briefId,
      }),
    );
    return buildStubDraftBodyFromBrief(brief, opts);
  }
  const baseUrl =
    process.env.MARKETER_OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const model =
    process.env.MARKETER_GENERATION_MODEL?.trim() || "gpt-4o-mini";

  const systemPrompt = opts?.brandContext
    ? `${SYSTEM_PROMPT}\n\n---\n${opts.brandContext}`
    : SYSTEM_PROMPT;

  const user = `Write marketing copy for this generation brief (JSON). Align tone with network=${brief.network} and formatId=${brief.formatId}.

${briefJsonForPrompt(brief)}`;
  try {
    const text = await completeOpenAiDraftChat({
      apiKey,
      baseUrl,
      model,
      system: systemPrompt,
      user,
    });
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return buildStubDraftBodyFromBrief(brief, opts);
    }
    return trimmed;
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "generation_draft_openai_fallback",
        briefId: brief.briefId,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return buildStubDraftBodyFromBrief(brief, opts);
  }
}
