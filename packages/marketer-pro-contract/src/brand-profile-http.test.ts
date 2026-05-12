import { describe, expect, it } from "vitest";

import { UpsertBrandProfileBodySchema } from "./brand-profile-http.js";
import {
  BrandIntelligenceProfileSchema,
  DEFAULT_HUMAN_OVERSIGHT_POLICY,
} from "./brand-intelligence.js";

const baseProfile = BrandIntelligenceProfileSchema.parse({
  profileId: "p1",
  workspaceId: "tenant-a",
  displayName: "Co",
  voice: {
    formality: "neutral",
    persona: "Helpful.",
    bannedPhrases: [],
    preferredPhrases: [],
    readingLevel: "professional",
  },
  audiences: [
    {
      audienceId: "a1",
      name: "Buyers",
      geography: ["US"],
      lifecycleStage: "awareness",
      painPoints: ["x"],
      goals: ["y"],
      preferredChannels: ["linkedin"],
    },
  ],
  knowledgeSources: [
    {
      sourceId: "s1",
      workspaceId: "tenant-a",
      kind: "faq",
      title: "FAQ",
      tags: ["help"],
      trusted: true,
      lastIndexedAt: null,
      createdAt: "2026-05-11T12:00:00.000Z",
    },
  ],
  defaultAudienceId: "a1",
  humanOversight: DEFAULT_HUMAN_OVERSIGHT_POLICY,
  version: 1,
  updatedAt: "2026-05-11T12:00:00.000Z",
});

describe("UpsertBrandProfileBodySchema", () => {
  it("accepts when tenantId matches workspaceId", () => {
    const r = UpsertBrandProfileBodySchema.safeParse({
      tenantId: "tenant-a",
      profile: baseProfile,
    });
    expect(r.success).toBe(true);
  });

  it("rejects when tenantId mismatches workspaceId", () => {
    const r = UpsertBrandProfileBodySchema.safeParse({
      tenantId: "other",
      profile: baseProfile,
    });
    expect(r.success).toBe(false);
  });
});
