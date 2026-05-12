import { describe, expect, it } from "vitest";

import {
  BrandIntelligenceProfileSchema,
  buildBrandGenerationContext,
  DEFAULT_HUMAN_OVERSIGHT_POLICY,
} from "./brand-intelligence.js";
import {
  cosineSimilarityEmbedding,
  lexicalRetrievalSnippetsFromProfile,
  rankBrandSnippetsByEmbedding,
  tokenizeRetrievalText,
} from "./brand-retrieval.js";

const profileJson = {
  profileId: "brand_profile_1",
  workspaceId: "ws_1",
  displayName: "ExampleCo",
  voice: {
    formality: "neutral",
    persona: "Strategic and direct.",
    bannedPhrases: [],
    preferredPhrases: ["systems"],
    readingLevel: "professional",
  },
  audiences: [
    {
      audienceId: "aud1",
      name: "Founders",
      geography: ["US"],
      lifecycleStage: "consideration",
      painPoints: ["manual work"],
      goals: ["pipeline"],
      preferredChannels: ["linkedin"],
    },
  ],
  knowledgeSources: [
    {
      sourceId: "src_pricing",
      workspaceId: "ws_1",
      kind: "website",
      title: "Pricing overview",
      tags: ["pricing", "plans"],
      trusted: true,
      summary: "Annual and monthly billing options for teams.",
      lastIndexedAt: "2026-05-11T13:00:00.000Z",
      createdAt: "2026-05-11T12:00:00.000Z",
    },
    {
      sourceId: "src_about",
      workspaceId: "ws_1",
      kind: "website",
      title: "About us",
      tags: ["team"],
      trusted: true,
      summary: "Company history and mission.",
      lastIndexedAt: "2026-05-11T12:00:00.000Z",
      createdAt: "2026-05-11T11:00:00.000Z",
    },
  ],
  defaultAudienceId: "aud1",
  humanOversight: DEFAULT_HUMAN_OVERSIGHT_POLICY,
  version: 1,
  updatedAt: "2026-05-11T14:00:00.000Z",
};

describe("tokenizeRetrievalText", () => {
  it("splits on punctuation and drops very short tokens", () => {
    expect(tokenizeRetrievalText("Hello, world!!")).toEqual(["hello", "world"]);
  });
});

describe("lexicalRetrievalSnippetsFromProfile", () => {
  it("returns empty for blank query", () => {
    const p = BrandIntelligenceProfileSchema.parse(profileJson);
    expect(lexicalRetrievalSnippetsFromProfile(p, "   ")).toEqual([]);
  });

  it("ranks pricing-related query above unrelated tokens", () => {
    const p = BrandIntelligenceProfileSchema.parse(profileJson);
    const snippets = lexicalRetrievalSnippetsFromProfile(
      p,
      "monthly billing pricing",
      { limit: 2 },
    );
    expect(snippets.length).toBeGreaterThanOrEqual(1);
    expect(snippets[0]!.sourceId).toBe("src_pricing");
    expect(snippets[0]!.score).toBeGreaterThan(0);
  });

  it("feeds buildBrandGenerationContext for prompt-ready flow", () => {
    const p = BrandIntelligenceProfileSchema.parse(profileJson);
    const snippets = lexicalRetrievalSnippetsFromProfile(p, "mission team", {
      limit: 4,
    });
    const ctx = buildBrandGenerationContext({
      profile: p,
      retrievalSnippets: snippets,
    });
    expect(ctx.retrievalSnippets.length).toBeGreaterThan(0);
  });
});

describe("cosineSimilarityEmbedding + rankBrandSnippetsByEmbedding", () => {
  it("returns 0 for length mismatch", () => {
    expect(cosineSimilarityEmbedding([1, 0], [1, 0, 0])).toBe(0);
  });

  it("orders candidates by similarity to query vector", () => {
    const q = [1, 0, 0] as const;
    const ranked = rankBrandSnippetsByEmbedding({
      queryEmbedding: q,
      candidates: [
        {
          sourceId: "a",
          citationLabel: "A",
          textExcerpt: "x",
          embedding: [0, 1, 0],
        },
        {
          sourceId: "b",
          citationLabel: "B",
          textExcerpt: "y",
          embedding: [1, 0, 0],
        },
      ],
      limit: 2,
    });
    expect(ranked[0]!.sourceId).toBe("b");
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });
});
