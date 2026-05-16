/**
 * Heuristic quality scores for a generated draft against the brand profile.
 *
 * voiceScore       — preferred/banned phrase alignment with BrandVoice (0–1).
 * complianceScore  — absence of forbidden claims from BrandComplianceRules (0–1).
 * formalityScore   — how closely the draft's detected formality matches the brand target (0–1).
 * readingLevelScore— how closely the draft's FK reading grade matches the brand target (0–1).
 * flags            — human-readable reasons for any score deductions.
 *
 * These are intentionally simple heuristics that run in-process with no I/O.
 * A model-as-judge pass can replace or supplement these later without changing
 * the response envelope.
 */

import type {
  BrandComplianceRules,
  BrandFormality,
  BrandReadingLevel,
  BrandVoice,
} from "@home-link/marketer-pro-contract";

// ---------------------------------------------------------------------------
// Phrase alignment (existing)
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.toLowerCase();
}

function preferredPhraseCoverage(draft: string, voice: BrandVoice): number {
  if (voice.preferredPhrases.length === 0) return 1;
  const lower = normalize(draft);
  const hits = voice.preferredPhrases.filter((p) =>
    lower.includes(normalize(p)),
  ).length;
  return hits / voice.preferredPhrases.length;
}

function bannedPhraseCheck(draft: string, voice: BrandVoice): 1 | 0 {
  const lower = normalize(draft);
  for (const phrase of voice.bannedPhrases ?? []) {
    if (lower.includes(normalize(phrase))) return 0;
  }
  return 1;
}

function findBannedPhraseViolations(draft: string, voice: BrandVoice): string[] {
  const lower = normalize(draft);
  return (voice.bannedPhrases ?? []).filter((p) => lower.includes(normalize(p)));
}

// ---------------------------------------------------------------------------
// Formality scoring
// ---------------------------------------------------------------------------

const CONTRACTION_RE =
  /\b(don't|doesn't|didn't|won't|wouldn't|can't|couldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|it's|that's|there's|they're|we're|you're|I'm|I've|I'd|I'll|we've|we'd|we'll|they've|they'd|they'll|you've|you'd|you'll|he's|she's|let's|what's|who's|how's|where's)\b/gi;

const CASUAL_WORD_RE =
  /\b(awesome|cool|hey|wanna|gonna|gotta|kinda|sorta|ya|yep|nope|yeah|nah|wow|lol|omg|btw|tbh|super|totally|literally|basically|honestly)\b/gi;

/**
 * Returns a raw formality signal in [0, 1] where 0 = very casual/playful and
 * 1 = very formal.  Uses four equally weighted heuristic components:
 *   1. Contraction absence rate
 *   2. Casual-word absence rate
 *   3. Exclamation-mark absence
 *   4. Average sentence length (≥ 20 words = fully formal)
 */
export function estimateFormalitySignal(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const wordCount = Math.max(1, words.length);

  const contractions = (text.match(CONTRACTION_RE) ?? []).length;
  const casualWords = (text.match(CASUAL_WORD_RE) ?? []).length;
  const exclamations = (text.match(/!/g) ?? []).length;
  const avgSentenceLen = wordCount / sentenceCount;

  const contractionScore = Math.max(0, 1 - contractions / sentenceCount);
  const casualScore = Math.max(
    0,
    1 - casualWords / Math.max(1, Math.floor(wordCount / 8)),
  );
  const exclamationScore = Math.max(0, 1 - exclamations / sentenceCount);
  const lengthScore = Math.min(1, avgSentenceLen / 20);

  return (
    contractionScore * 0.35 +
    casualScore * 0.25 +
    exclamationScore * 0.2 +
    lengthScore * 0.2
  );
}

const FORMALITY_TARGETS: Record<BrandFormality, number> = {
  formal: 0.8,
  neutral: 0.55,
  casual: 0.3,
  playful: 0.15,
};

/**
 * Scores how well the draft's formality signal matches the brand target.
 * Returns 1.0 when signal is within ±0.1 of target; scales to 0 at ±0.4.
 */
function formalityScore(draft: string, voice: BrandVoice): number {
  const signal = estimateFormalitySignal(draft);
  const target = FORMALITY_TARGETS[voice.formality];
  const distance = Math.abs(signal - target);
  return Math.max(0, Math.round((1 - distance / 0.4) * 100) / 100);
}

// ---------------------------------------------------------------------------
// Reading-level scoring (Flesch-Kincaid approximation)
// ---------------------------------------------------------------------------

/** Approximate syllable count via vowel groups. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * Flesch-Kincaid Grade Level for the draft text.
 * Returns a grade in the range [0, ~20].
 * Returns 8 (mid-high-school) when the text is too short to compute reliably.
 */
export function estimateReadingGrade(text: string): number {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  if (wordCount < 10) return 8;

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const syllableCount = words.reduce((n, w) => n + countSyllables(w), 0);

  const grade =
    0.39 * (wordCount / sentenceCount) +
    11.8 * (syllableCount / wordCount) -
    15.59;
  return Math.max(0, grade);
}

const READING_LEVEL_ORDER: BrandReadingLevel[] = [
  "elementary",
  "middle",
  "high_school",
  "college",
  "professional",
];

/** Map an FK grade to the nearest BrandReadingLevel. */
export function readingGradeToLevel(grade: number): BrandReadingLevel {
  if (grade < 4) return "elementary";
  if (grade < 7) return "middle";
  if (grade < 11) return "high_school";
  if (grade < 14) return "college";
  return "professional";
}

/**
 * Scores reading-level alignment. Band distance ≥ 4 → 0; same band → 1;
 * each band apart subtracts 0.25.
 */
function readingLevelScore(draft: string, voice: BrandVoice): number {
  const grade = estimateReadingGrade(draft);
  const detected = readingGradeToLevel(grade);
  const detectedIdx = READING_LEVEL_ORDER.indexOf(detected);
  const targetIdx = READING_LEVEL_ORDER.indexOf(voice.readingLevel);
  const distance = Math.abs(detectedIdx - targetIdx);
  return Math.max(0, Math.round((1 - distance * 0.25) * 100) / 100);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type DraftQualityScore = {
  /** 0–1. Blend of preferred phrase coverage and absence of banned phrases. */
  readonly voiceScore: number;
  /** 0–1. 1 = no forbidden claims detected; 0 = at least one found. */
  readonly complianceScore: number;
  /** 0–1. How well draft formality matches brand target (formal/neutral/casual/playful). */
  readonly formalityScore: number;
  /** 0–1. How well draft reading grade matches brand target level. */
  readonly readingLevelScore: number;
  /** Human-readable reasons for any score deductions. */
  readonly flags: readonly string[];
};

/**
 * Compute voice + compliance + formality + readingLevel scores for a generated
 * draft against the brand. Pass `null` for `voice` or `compliance` to skip
 * those dimensions (they return 1 in that case).
 */
export function scoreDraft(
  draftBody: string,
  voice: BrandVoice | null,
  compliance: BrandComplianceRules | null,
): DraftQualityScore {
  const flags: string[] = [];

  let voiceScore = 1;
  let fScore = 1;
  let rlScore = 1;

  if (voice) {
    const coverage = preferredPhraseCoverage(draftBody, voice);
    const bannedOk = bannedPhraseCheck(draftBody, voice);

    // A banned phrase is a hard failure — collapses score to 0 regardless of coverage.
    voiceScore =
      bannedOk === 0 ? 0 : Math.round(coverage * 100) / 100;

    if (bannedOk === 0) {
      const violations = findBannedPhraseViolations(draftBody, voice);
      flags.push(`Contains banned phrase: "${violations[0]}"`);
    }
    if (coverage < 0.5 && voice.preferredPhrases.length > 0) {
      const missing = Math.round((1 - coverage) * voice.preferredPhrases.length);
      flags.push(
        `Missing preferred phrases (${missing} of ${voice.preferredPhrases.length} not found)`,
      );
    }

    fScore = formalityScore(draftBody, voice);
    if (fScore < 0.6) {
      const signal = estimateFormalitySignal(draftBody);
      const detected =
        signal >= 0.65
          ? "formal"
          : signal >= 0.4
            ? "neutral"
            : signal >= 0.22
              ? "casual"
              : "playful";
      flags.push(
        `Formality mismatch: text reads as "${detected}", brand target is "${voice.formality}"`,
      );
    }

    rlScore = readingLevelScore(draftBody, voice);
    if (rlScore < 0.75) {
      const grade = estimateReadingGrade(draftBody);
      const detected = readingGradeToLevel(grade);
      flags.push(
        `Reading level mismatch: detected "${detected}" (grade ~${grade.toFixed(1)}), brand target is "${voice.readingLevel}"`,
      );
    }
  }

  let complianceScore = 1;
  if (compliance?.forbiddenClaims && compliance.forbiddenClaims.length > 0) {
    const lower = normalize(draftBody);
    const violation = compliance.forbiddenClaims.find((claim) =>
      lower.includes(normalize(claim)),
    );
    if (violation) {
      complianceScore = 0;
      flags.push(`Contains forbidden claim: "${violation}"`);
    }
  }

  return {
    voiceScore,
    complianceScore,
    formalityScore: fScore,
    readingLevelScore: rlScore,
    flags,
  };
}
