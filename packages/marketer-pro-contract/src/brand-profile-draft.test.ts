import { describe, expect, it } from "vitest";

import {
  BRAND_PROFILE_DRAFT_STORAGE_KEY,
  clearBrandProfileDraft,
  readBrandProfileDraft,
  writeBrandProfileDraft,
  type BrandProfileDraftStorage,
} from "./brand-profile-draft.js";
import { DEFAULT_HUMAN_OVERSIGHT_POLICY, type BrandIntelligenceProfile } from "./brand-intelligence.js";

const T0 = "2026-05-11T12:00:00.000Z";
const T1 = "2026-05-11T13:00:00.000Z";

function minimalProfile(): BrandIntelligenceProfile {
  return {
    profileId: "p1",
    workspaceId: "ws_1",
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
        workspaceId: "ws_1",
        kind: "website",
        title: "Site",
        tags: ["t"],
        trusted: true,
        lastIndexedAt: null,
        createdAt: T0,
      },
    ],
    defaultAudienceId: "a1",
    humanOversight: DEFAULT_HUMAN_OVERSIGHT_POLICY,
    version: 1,
    updatedAt: T1,
  };
}

function memoryStorage(): BrandProfileDraftStorage {
  const map = new Map<string, string>();
  return {
    getItem(k: string) {
      return map.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
    removeItem(k: string) {
      map.delete(k);
    },
  };
}

describe("brand profile draft storage", () => {
  it("round-trips a profile through a storage adapter", () => {
    const mem = memoryStorage();
    const p = minimalProfile();
    writeBrandProfileDraft(mem, p);
    expect(readBrandProfileDraft(mem)).toEqual(p);
    clearBrandProfileDraft(mem);
    expect(readBrandProfileDraft(mem)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const mem = memoryStorage();
    mem.setItem(BRAND_PROFILE_DRAFT_STORAGE_KEY, "{not json");
    expect(readBrandProfileDraft(mem)).toBeNull();
  });
});
