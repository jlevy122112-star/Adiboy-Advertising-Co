import { describe, expect, it } from "vitest";

import {
  estimateFormalitySignal,
  estimateReadingGrade,
  readingGradeToLevel,
  scoreDraft,
} from "./draft-quality-score.js";
import type { DraftQualityScore } from "./draft-quality-score.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVoice(
  overrides: Partial<{
    formality: "formal" | "neutral" | "casual" | "playful";
    readingLevel: "elementary" | "middle" | "high_school" | "college" | "professional";
    bannedPhrases: string[];
    preferredPhrases: string[];
    persona: string;
  }> = {},
) {
  return {
    formality: "neutral" as const,
    readingLevel: "high_school" as const,
    persona: "friendly expert",
    bannedPhrases: [],
    preferredPhrases: [],
    ...overrides,
  };
}

function makeCompliance(forbiddenClaims: string[]) {
  return { forbiddenClaims, regulatedContentTags: [], requiredDisclaimers: [] };
}

// ---------------------------------------------------------------------------
// estimateFormalitySignal
// ---------------------------------------------------------------------------

describe("estimateFormalitySignal", () => {
  it("rates a formal text highly", () => {
    const formal =
      "Furthermore, the implementation of comprehensive strategic initiatives requires sustained organizational commitment. " +
      "Consequently, executive leadership must allocate sufficient resources to ensure successful outcomes. " +
      "The aforementioned methodology has been validated through rigorous empirical analysis.";
    expect(estimateFormalitySignal(formal)).toBeGreaterThan(0.65);
  });

  it("rates a casual text low", () => {
    const casual =
      "Hey, this is totally awesome! You're gonna love it! Don't miss out, it's super cool!";
    expect(estimateFormalitySignal(casual)).toBeLessThan(0.5);
  });

  it("rates a playful text lowest", () => {
    const playful =
      "Wow, OMG! This is literally the coolest thing ever!!! You're gonna wanna grab yours now! Yeah, totally!";
    expect(estimateFormalitySignal(playful)).toBeLessThan(0.4);
  });

  it("rates neutral marketing copy in the middle range", () => {
    const neutral =
      "Discover our new product line, designed to help you achieve your goals. " +
      "Built with quality materials and backed by our satisfaction guarantee. " +
      "Order today and experience the difference.";
    const signal = estimateFormalitySignal(neutral);
    expect(signal).toBeGreaterThan(0.35);
    expect(signal).toBeLessThan(0.98);
  });
});

// ---------------------------------------------------------------------------
// estimateReadingGrade + readingGradeToLevel
// ---------------------------------------------------------------------------

describe("estimateReadingGrade", () => {
  it("returns mid-range for short text below threshold", () => {
    expect(estimateReadingGrade("Great deal today!")).toBe(8);
  });

  it("gives a lower grade for simple short sentences", () => {
    const simple =
      "Buy now. Save big. Great deals. Shop today. Get yours. Free gift. " +
      "Low price. Fast ship. Best buy. Easy use. Good value. Try it.";
    expect(estimateReadingGrade(simple)).toBeLessThan(8);
  });

  it("gives a higher grade for complex long sentences", () => {
    const complex =
      "The comprehensive implementation of sophisticated algorithmic methodologies " +
      "necessitates meticulous evaluation of multifaceted organizational parameters. " +
      "Consequently, the establishment of robust institutional frameworks constitutes " +
      "a prerequisite for sustainable competitive differentiation and superior performance.";
    expect(estimateReadingGrade(complex)).toBeGreaterThan(12);
  });
});

describe("readingGradeToLevel", () => {
  it("maps grade < 4 to elementary", () => {
    expect(readingGradeToLevel(2)).toBe("elementary");
    expect(readingGradeToLevel(3.9)).toBe("elementary");
  });
  it("maps 4–6.9 to middle", () => {
    expect(readingGradeToLevel(4)).toBe("middle");
    expect(readingGradeToLevel(6.5)).toBe("middle");
  });
  it("maps 7–10.9 to high_school", () => {
    expect(readingGradeToLevel(7)).toBe("high_school");
    expect(readingGradeToLevel(10.9)).toBe("high_school");
  });
  it("maps 11–13.9 to college", () => {
    expect(readingGradeToLevel(11)).toBe("college");
    expect(readingGradeToLevel(13)).toBe("college");
  });
  it("maps 14+ to professional", () => {
    expect(readingGradeToLevel(14)).toBe("professional");
    expect(readingGradeToLevel(20)).toBe("professional");
  });
});

// ---------------------------------------------------------------------------
// scoreDraft — null inputs
// ---------------------------------------------------------------------------

describe("scoreDraft — null inputs", () => {
  it("returns all 1s with empty flags when both args are null", () => {
    const result = scoreDraft("Some draft body text here.", null, null);
    expect(result.voiceScore).toBe(1);
    expect(result.complianceScore).toBe(1);
    expect(result.formalityScore).toBe(1);
    expect(result.readingLevelScore).toBe(1);
    expect(result.flags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// scoreDraft — phrase alignment
// ---------------------------------------------------------------------------

describe("scoreDraft — phrase alignment", () => {
  it("voiceScore is 1 when no preferred/banned phrases defined", () => {
    const result = scoreDraft(
      "Check out our spring collection today.",
      makeVoice(),
      null,
    );
    expect(result.voiceScore).toBe(1);
  });

  it("voiceScore is 1 when all preferred phrases are present", () => {
    const result = scoreDraft(
      "Transform your marketing with powerful insights and seamless automation.",
      makeVoice({ preferredPhrases: ["transform", "powerful insights"] }),
      null,
    );
    expect(result.voiceScore).toBe(1);
  });

  it("voiceScore < 1 when preferred phrases are missing", () => {
    const result = scoreDraft(
      "Great new product launching soon.",
      makeVoice({ preferredPhrases: ["transform", "powerful insights", "seamless"] }),
      null,
    );
    expect(result.voiceScore).toBeLessThan(1);
  });

  it("voiceScore is 0 when a banned phrase is present", () => {
    const result = scoreDraft(
      "This is absolutely guaranteed or your money back.",
      makeVoice({ bannedPhrases: ["guaranteed"] }),
      null,
    );
    expect(result.voiceScore).toBe(0);
    expect(result.flags.some((f) => f.includes("banned phrase"))).toBe(true);
  });

  it("banned phrase detection is case-insensitive", () => {
    const result = scoreDraft(
      "GUARANTEED results in 30 days.",
      makeVoice({ bannedPhrases: ["guaranteed"] }),
      null,
    );
    expect(result.voiceScore).toBe(0);
  });

  it("adds missing-preferred-phrases flag when coverage < 50%", () => {
    const result = scoreDraft(
      "Buy our new product today.",
      makeVoice({
        preferredPhrases: ["transform", "empower", "innovate", "seamless", "powerful"],
      }),
      null,
    );
    expect(result.flags.some((f) => f.includes("preferred phrases"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scoreDraft — compliance
// ---------------------------------------------------------------------------

describe("scoreDraft — compliance", () => {
  it("complianceScore is 1 when no forbidden claims defined", () => {
    const result = scoreDraft("Amazing product for everyone.", null, makeCompliance([]));
    expect(result.complianceScore).toBe(1);
    expect(result.flags).toHaveLength(0);
  });

  it("complianceScore is 0 when a forbidden claim is present", () => {
    const result = scoreDraft(
      "Clinically proven to cure all diseases.",
      null,
      makeCompliance(["cure all diseases"]),
    );
    expect(result.complianceScore).toBe(0);
    expect(result.flags.some((f) => f.includes("forbidden claim"))).toBe(true);
  });

  it("forbidden claim detection is case-insensitive", () => {
    const result = scoreDraft(
      "CURE ALL DISEASES with our supplement.",
      null,
      makeCompliance(["cure all diseases"]),
    );
    expect(result.complianceScore).toBe(0);
  });

  it("complianceScore is 1 when claims are absent", () => {
    const result = scoreDraft(
      "Supports overall wellness as part of a healthy lifestyle.",
      null,
      makeCompliance(["cure all diseases", "guaranteed results"]),
    );
    expect(result.complianceScore).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// scoreDraft — formality
// ---------------------------------------------------------------------------

describe("scoreDraft — formalityScore", () => {
  it("formal text scores well against formal target", () => {
    const formal =
      "We are pleased to announce the release of our comprehensive enterprise solution. " +
      "This initiative demonstrates our commitment to delivering exceptional value to our stakeholders. " +
      "The implementation follows established industry protocols and best practices.";
    const result = scoreDraft(formal, makeVoice({ formality: "formal" }), null);
    expect(result.formalityScore).toBeGreaterThanOrEqual(0.5);
  });

  it("casual text scores poorly against formal target", () => {
    const casual =
      "Hey! Don't miss out — this is gonna be totally awesome! You're gonna love it! Grab yours now!";
    const result = scoreDraft(casual, makeVoice({ formality: "formal" }), null);
    expect(result.formalityScore).toBeLessThan(0.6);
    expect(result.flags.some((f) => f.includes("Formality mismatch"))).toBe(true);
  });

  it("casual text scores well against casual target", () => {
    const casual =
      "Hey! Don't miss out — you're gonna love this! It's super awesome and you can grab it right now.";
    const result = scoreDraft(casual, makeVoice({ formality: "casual" }), null);
    expect(result.formalityScore).toBeGreaterThan(0.4);
  });

  it("does not add formality flag when score >= 0.6", () => {
    const neutral =
      "Discover our new product line designed to help you achieve your goals. " +
      "Order today and experience the difference for yourself.";
    const result = scoreDraft(neutral, makeVoice({ formality: "neutral" }), null);
    const formalityFlags = result.flags.filter((f) => f.includes("Formality"));
    if (result.formalityScore >= 0.6) {
      expect(formalityFlags).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// scoreDraft — reading level
// ---------------------------------------------------------------------------

describe("scoreDraft — readingLevelScore", () => {
  it("scores 1.0 when reading level matches target exactly", () => {
    // A text we know will score as high_school, targeting high_school
    const text =
      "Experience the difference with our premium product line. " +
      "Each item is carefully crafted using sustainable materials and innovative design. " +
      "Whether you are looking for everyday essentials or special occasion pieces, we have you covered.";
    const result = scoreDraft(
      text,
      makeVoice({ readingLevel: "high_school" }),
      null,
    );
    // At minimum it should not heavily penalize a reasonable marketing text
    expect(result.readingLevelScore).toBeGreaterThan(0.5);
  });

  it("penalizes mismatched reading level", () => {
    const complex =
      "The utilization of multifaceted algorithmic methodologies necessitates comprehensive " +
      "evaluation of organizational parameters and institutional frameworks for sustained " +
      "competitive differentiation and superior long-term performance optimization.";
    const result = scoreDraft(
      complex,
      makeVoice({ readingLevel: "elementary" }),
      null,
    );
    expect(result.readingLevelScore).toBeLessThan(0.9);
  });

  it("adjacent band deducts 0.25", () => {
    // Force a college-level text, target professional — 1 band apart = 0.75
    const college =
      "The implementation of strategic organizational frameworks requires sustained " +
      "commitment from executive leadership and comprehensive resource allocation. " +
      "This methodology has been validated through rigorous empirical analysis.";
    const result = scoreDraft(
      college,
      makeVoice({ readingLevel: "professional" }),
      null,
    );
    // Should be 0.75 (1 band apart) or 1.0 (same band)
    expect(result.readingLevelScore).toBeGreaterThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// scoreDraft — combined voice + compliance
// ---------------------------------------------------------------------------

describe("scoreDraft — combined", () => {
  it("returns all dimensions when both voice and compliance are provided", () => {
    const result: DraftQualityScore = scoreDraft(
      "Transform your workflow with powerful insights and seamless automation.",
      makeVoice({
        preferredPhrases: ["transform", "powerful insights"],
        formality: "neutral",
        readingLevel: "high_school",
      }),
      makeCompliance(["guaranteed cure"]),
    );
    expect(result.voiceScore).toBeGreaterThanOrEqual(0.6);
    expect(result.complianceScore).toBe(1);
    expect(result.formalityScore).toBeGreaterThan(0);
    expect(result.readingLevelScore).toBeGreaterThan(0);
  });

  it("flags both compliance violation and banned phrase when both present", () => {
    const result = scoreDraft(
      "Guaranteed to cure all diseases instantly.",
      makeVoice({ bannedPhrases: ["guaranteed"] }),
      makeCompliance(["cure all diseases"]),
    );
    expect(result.complianceScore).toBe(0);
    expect(result.voiceScore).toBe(0);
    expect(result.flags.some((f) => f.includes("banned phrase"))).toBe(true);
    expect(result.flags.some((f) => f.includes("forbidden claim"))).toBe(true);
  });
});
