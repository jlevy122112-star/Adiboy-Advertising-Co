/**
 * Deterministic draft text from a {@link GenerationBrief} — Phase 2 stub
 * implementation. Replace this module’s core function with a model-backed
 * generator when wiring the real stack; {@link executeCreateGenerationDraft}
 * should keep calling {@link generateDraftBodyFromBrief}.
 */

import type { GenerationBrief } from "@home-link/marketer-pro-contract";

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
      body.length > 400 ? `${body.slice(0, 400)}…` : body;
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
    out.push(`Formality (1–5): ${v.formalityOverride}`);
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
 * Produces placeholder copy for human review until a model provider is wired.
 * Uses only fields already on the brief (no network I/O).
 */
export function generateDraftBodyFromBrief(brief: GenerationBrief): string {
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
  parts.push(
    "",
    "—",
    "Stub draft (replace with model output when wiring the real generator).",
  );
  return parts.join("\n");
}
