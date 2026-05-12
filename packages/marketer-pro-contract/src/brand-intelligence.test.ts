import { describe, expect, it } from "vitest";

import {
  audiencePrefersChannel,
  AUDIENCE_LIFECYCLE_STAGES,
  AudienceLifecycleStageSchema,
  AudienceProfileSchema,
  BRAND_INTELLIGENCE_ISSUE_CODES,
  BRAND_KNOWLEDGE_SOURCE_KINDS,
  BrandGenerationContextSchema,
  BrandIntelligenceProfileSchema,
  BrandKnowledgeSourceKindSchema,
  BrandKnowledgeSourceSchema,
  BrandProfileSchema,
  BrandRetrievalSnippetSchema,
  buildBrandGenerationContext,
  DEFAULT_HUMAN_OVERSIGHT_POLICY,
  formatBrandGenerationContextForPrompt,
  HUMAN_OVERSIGHT_CHECKPOINTS,
  HUMAN_OVERSIGHT_MODES,
  HumanOversightCheckpointSchema,
  HumanOversightModeSchema,
  HumanOversightPolicySchema,
  selectTrustedKnowledgeSources,
  summarizeBrandVoice,
  validateBrandIntelligenceProfile,
  type AudienceProfile,
  type BrandIntelligenceProfile,
  type BrandKnowledgeSource,
  type BrandRetrievalSnippet,
} from "./brand-intelligence.js";

const T0 = "2026-05-11T12:00:00.000Z";
const T1 = "2026-05-11T13:00:00.000Z";
const T2 = "2026-05-11T14:00:00.000Z";

const baseAudience: AudienceProfile = {
  audienceId: "aud_founders",
  name: "B2B SaaS founders",
  description: "Operators building repeatable growth systems.",
  geography: ["US", "Canada"],
  lifecycleStage: "consideration",
  painPoints: ["too many manual content tasks"],
  goals: ["turn expertise into consistent pipeline"],
  preferredChannels: ["linkedin", "x"],
  readingLevelHint: "professional",
  notes: "Skims first, saves tactical frameworks.",
};

function source(
  overrides: Partial<BrandKnowledgeSource> = {},
): BrandKnowledgeSource {
  return {
    sourceId: "src_website",
    workspaceId: "ws_1",
    kind: "website",
    title: "Positioning page",
    uri: "https://example.com/positioning",
    tags: ["positioning", "homepage"],
    trusted: true,
    summary: "Primary offer and proof points.",
    lastIndexedAt: T1,
    createdAt: T0,
    ...overrides,
  };
}

function snippet(
  overrides: Partial<BrandRetrievalSnippet> = {},
): BrandRetrievalSnippet {
  return {
    snippetId: "snip_1",
    sourceId: "src_website",
    citationLabel: "Positioning page",
    textExcerpt: "We help founders turn domain expertise into demand.",
    score: 0.82,
    metadata: { section: "hero" },
    ...overrides,
  };
}

function profile(
  overrides: Partial<BrandIntelligenceProfile> = {},
): BrandIntelligenceProfile {
  return {
    profileId: "brand_profile_1",
    workspaceId: "ws_1",
    displayName: "ExampleCo",
    voice: {
      formality: "neutral",
      persona: "Strategic, direct, and practical.",
      bannedPhrases: ["growth hack"],
      preferredPhrases: ["repeatable growth system"],
      readingLevel: "professional",
    },
    audiences: [baseAudience],
    knowledgeSources: [source()],
    defaultAudienceId: "aud_founders",
    humanOversight: DEFAULT_HUMAN_OVERSIGHT_POLICY,
    version: 1,
    updatedAt: T1,
    ...overrides,
  };
}

describe("brand intelligence rosters", () => {
  it("exports canonical lifecycle stages and source kinds", () => {
    expect(AUDIENCE_LIFECYCLE_STAGES).toEqual([
      "awareness",
      "consideration",
      "conversion",
      "retention",
      "advocacy",
    ]);
    expect(BRAND_KNOWLEDGE_SOURCE_KINDS).toEqual([
      "website",
      "uploaded_file",
      "product_doc",
      "faq",
      "prior_post",
      "manual_note",
      "serp_result",
      "customer_research",
    ]);
    for (const stage of AUDIENCE_LIFECYCLE_STAGES) {
      expect(AudienceLifecycleStageSchema.parse(stage)).toBe(stage);
    }
    for (const kind of BRAND_KNOWLEDGE_SOURCE_KINDS) {
      expect(BrandKnowledgeSourceKindSchema.parse(kind)).toBe(kind);
    }
    expect(HUMAN_OVERSIGHT_MODES).toEqual([
      "optional_review",
      "approval_required",
    ]);
    expect(HUMAN_OVERSIGHT_CHECKPOINTS).toContain("content_generation");
    expect(HUMAN_OVERSIGHT_CHECKPOINTS).toContain("scheduling");
    for (const mode of HUMAN_OVERSIGHT_MODES) {
      expect(HumanOversightModeSchema.parse(mode)).toBe(mode);
    }
    for (const checkpoint of HUMAN_OVERSIGHT_CHECKPOINTS) {
      expect(HumanOversightCheckpointSchema.parse(checkpoint)).toBe(checkpoint);
    }
  });
});

describe("AudienceProfileSchema", () => {
  it("accepts a complete audience profile", () => {
    expect(AudienceProfileSchema.parse(baseAudience)).toEqual(baseAudience);
  });

  it("rejects empty audience names and unknown fields", () => {
    expect(
      AudienceProfileSchema.safeParse({ ...baseAudience, name: "" }).success,
    ).toBe(false);
    expect(
      AudienceProfileSchema.safeParse({
        ...baseAudience,
        surprise: true,
      }).success,
    ).toBe(false);
  });
});

describe("BrandKnowledgeSourceSchema", () => {
  it("accepts retrieval-ready source metadata", () => {
    expect(BrandKnowledgeSourceSchema.parse(source())).toEqual(source());
  });

  it("rejects empty titles and unknown source kinds", () => {
    expect(
      BrandKnowledgeSourceSchema.safeParse({
        ...source(),
        title: "",
      }).success,
    ).toBe(false);
    expect(
      BrandKnowledgeSourceSchema.safeParse({
        ...source(),
        kind: "spreadsheet",
      }).success,
    ).toBe(false);
  });
});

describe("BrandRetrievalSnippetSchema", () => {
  it("bounds excerpts and scores for provider prompt safety", () => {
    expect(BrandRetrievalSnippetSchema.parse(snippet())).toEqual(snippet());
    expect(
      BrandRetrievalSnippetSchema.safeParse({
        ...snippet(),
        score: 1.2,
      }).success,
    ).toBe(false);
    expect(
      BrandRetrievalSnippetSchema.safeParse({
        ...snippet(),
        textExcerpt: "",
      }).success,
    ).toBe(false);
  });
});

describe("HumanOversightPolicySchema", () => {
  it("keeps human user review and override available by contract", () => {
    expect(HumanOversightPolicySchema.parse(DEFAULT_HUMAN_OVERSIGHT_POLICY)).toEqual(
      DEFAULT_HUMAN_OVERSIGHT_POLICY,
    );
    expect(DEFAULT_HUMAN_OVERSIGHT_POLICY.enabled).toBe(true);
    expect(DEFAULT_HUMAN_OVERSIGHT_POLICY.allowUserOverride).toBe(true);
    expect(DEFAULT_HUMAN_OVERSIGHT_POLICY.checkpoints).toContain(
      "calendar_planning",
    );
  });

  it("rejects attempts to remove human oversight or user override", () => {
    expect(
      HumanOversightPolicySchema.safeParse({
        ...DEFAULT_HUMAN_OVERSIGHT_POLICY,
        enabled: false,
      }).success,
    ).toBe(false);
    expect(
      HumanOversightPolicySchema.safeParse({
        ...DEFAULT_HUMAN_OVERSIGHT_POLICY,
        allowUserOverride: false,
      }).success,
    ).toBe(false);
  });
});

describe("BrandIntelligenceProfileSchema", () => {
  it("accepts the canonical profile shape", () => {
    expect(BrandIntelligenceProfileSchema.parse(profile())).toEqual(profile());
  });

  it("reuses BrandVoiceSchema for voice validation", () => {
    expect(
      BrandIntelligenceProfileSchema.safeParse({
        ...profile(),
        voice: { ...profile().voice, formality: "corporate" },
      }).success,
    ).toBe(false);
  });
});

describe("selectTrustedKnowledgeSources", () => {
  it("filters to trusted sources and sorts newest indexed first", () => {
    const selected = selectTrustedKnowledgeSources([
      source({
        sourceId: "src_old",
        tags: ["positioning"],
        lastIndexedAt: T0,
      }),
      source({
        sourceId: "src_untrusted",
        trusted: false,
        lastIndexedAt: T2,
      }),
      source({
        sourceId: "src_new",
        kind: "faq",
        tags: ["support"],
        lastIndexedAt: T2,
      }),
    ]);

    expect(selected.map((item) => item.sourceId)).toEqual([
      "src_new",
      "src_old",
    ]);
  });

  it("filters by source kind, tag, and limit", () => {
    const selected = selectTrustedKnowledgeSources(
      [
        source({ sourceId: "src_product", kind: "product_doc", tags: ["sku"] }),
        source({ sourceId: "src_faq", kind: "faq", tags: ["support"] }),
        source({ sourceId: "src_site", kind: "website", tags: ["support"] }),
      ],
      { kinds: ["faq", "website"], tags: ["support"], limit: 1 },
    );

    expect(selected).toHaveLength(1);
    expect(["src_faq", "src_site"]).toContain(selected[0]?.sourceId);
  });
});

describe("validateBrandIntelligenceProfile", () => {
  it("returns ok for a generation-ready profile", () => {
    expect(validateBrandIntelligenceProfile(profile())).toEqual({ ok: true });
  });

  it("returns structured issues for user-fixable profile gaps", () => {
    const result = validateBrandIntelligenceProfile(
      profile({
        voice: { ...profile().voice, persona: "   " },
        audiences: [],
        knowledgeSources: [source({ trusted: false })],
        defaultAudienceId: "missing",
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code).sort()).toEqual([
        "default_audience_missing",
        "no_trusted_knowledge_sources",
        "profile_has_no_audiences",
        "voice_persona_empty",
      ]);
      for (const issue of result.issues) {
        expect(BRAND_INTELLIGENCE_ISSUE_CODES).toContain(issue.code);
      }
    }
  });
});

describe("summarizeBrandVoice", () => {
  it("combines base voice and per-brief voice directives", () => {
    const summary = summarizeBrandVoice(profile().voice, {
      toneShift: "more_authoritative",
      formalityOverride: 5,
      preferredPhrasesAdditional: ["operator-grade"],
      bannedWordsAdditional: ["easy money"],
      note: "Avoid hype.",
    });

    expect(summary).toContain("Strategic, direct, and practical.");
    expect(summary).toContain("Tone shift: more_authoritative");
    expect(summary).toContain("operator-grade");
    expect(summary).toContain("easy money");
  });
});

describe("buildBrandGenerationContext", () => {
  it("builds a normalized context with default audience and trusted sources", () => {
    const context = buildBrandGenerationContext({
      profile: profile({
        knowledgeSources: [
          source({ sourceId: "trusted_1", trusted: true }),
          source({ sourceId: "untrusted_1", trusted: false }),
        ],
      }),
      retrievalSnippets: [
        snippet({ snippetId: "low", score: 0.2 }),
        snippet({ snippetId: "high", score: 0.95 }),
      ],
      voiceDirectives: { toneShift: "more_professional" },
    });

    expect(BrandGenerationContextSchema.parse(context)).toEqual(context);
    expect(context.audience?.audienceId).toBe("aud_founders");
    expect(context.retrievalSnippets.map((item) => item.snippetId)).toEqual([
      "high",
      "low",
    ]);
    expect(context.trustedSourceIds).toEqual(["trusted_1"]);
    expect(context.voiceSummary).toContain("more_professional");
    expect(context.humanOversight).toEqual(DEFAULT_HUMAN_OVERSIGHT_POLICY);
  });

  it("carries compliance rules and product facts from the profile into context", () => {
    const compliance = {
      forbiddenClaims: ["Guaranteed 10x returns in 30 days"],
      regulatedContentTags: ["financial_services"],
      requiredDisclaimers: [
        {
          disclaimerId: "fin_general",
          text: "Not investment advice.",
          appliesWhen: "Discussing performance or ROI",
        },
      ],
    };
    const productFacts = [
      {
        factId: "fact_pricing",
        label: "Starter price",
        body: "Starter tier is $49/mo billed annually.",
        sourceId: "src_website",
      },
    ];

    const context = buildBrandGenerationContext({
      profile: profile({ compliance, productFacts }),
    });

    expect(context.compliance).toEqual(compliance);
    expect(context.productFacts).toEqual(productFacts);
    expect(BrandProfileSchema.parse(profile({ compliance, productFacts }))).toEqual(
      profile({ compliance, productFacts }),
    );
  });

  it("honors an explicit audience and retrieval snippet cap", () => {
    const secondAudience: AudienceProfile = {
      ...baseAudience,
      audienceId: "aud_marketers",
      name: "Growth marketers",
      preferredChannels: ["instagram"],
    };

    const context = buildBrandGenerationContext({
      profile: profile({ audiences: [baseAudience, secondAudience] }),
      audienceId: "aud_marketers",
      retrievalSnippets: [
        snippet({ snippetId: "a", score: 0.1 }),
        snippet({ snippetId: "b", score: 0.9 }),
        snippet({ snippetId: "c", score: 0.8 }),
      ],
      maxRetrievalSnippets: 2,
    });

    expect(context.audience?.audienceId).toBe("aud_marketers");
    expect(context.retrievalSnippets.map((item) => item.snippetId)).toEqual([
      "b",
      "c",
    ]);
  });
});

describe("audiencePrefersChannel", () => {
  it("checks platform preference against the audience profile", () => {
    expect(audiencePrefersChannel(baseAudience, "linkedin")).toBe(true);
    expect(audiencePrefersChannel(baseAudience, "instagram")).toBe(false);
  });
});

describe("formatBrandGenerationContextForPrompt", () => {
  it("includes compliance and product facts sections when present", () => {
    const compliance = {
      forbiddenClaims: ["No medical cures"],
      regulatedContentTags: ["health"],
      requiredDisclaimers: [
        { disclaimerId: "h1", text: "Consult a physician.", appliesWhen: "Health claims" },
      ],
    };
    const productFacts = [
      { factId: "f1", label: "SKU", body: "Widget Pro ships in 2 days." },
    ];
    const text = formatBrandGenerationContextForPrompt(
      buildBrandGenerationContext({
        profile: profile({ compliance, productFacts }),
        retrievalSnippets: [snippet({ citationLabel: "FAQ", textExcerpt: "Returns within 30 days." })],
      }),
    );

    expect(text).toContain("### Compliance (must follow)");
    expect(text).toContain("No medical cures");
    expect(text).toContain("### Product / service facts");
    expect(text).toContain("Widget Pro ships in 2 days.");
    expect(text).toContain("[FAQ]");
  });
});
