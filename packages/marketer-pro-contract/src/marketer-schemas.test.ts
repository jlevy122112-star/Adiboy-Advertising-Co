import { describe, expect, it } from "vitest";
import {
  MarketerStateSchema,
  MarketerWebhookPublishBodySchema,
  parseMarketerState,
} from "./index.js";

const sampleOnboarding = {
  steps: [
    {
      id: "branding",
      label: "Brand your workspace",
      done: false,
      href: "#branding",
    },
    {
      id: "brief",
      label: "Complete campaign brief",
      done: false,
      href: "#dashboard",
    },
    {
      id: "content",
      label: "Generate & confirm content",
      done: true,
      href: "#dashboard",
    },
    {
      id: "schedule",
      label: "Build your content calendar",
      done: false,
      href: "#calendar",
    },
    {
      id: "channels",
      label: "Connect Meta (Facebook Page)",
      done: false,
      href: "#channels",
    },
    {
      id: "plan",
      label: "Activate subscription",
      done: false,
      href: "#pricing",
    },
  ],
  percentComplete: 17,
};

const sampleEntitlementsFree = {
  maxScheduleDays: 7,
  canUseAiGenerate: false,
  canLivePublish: false,
  maxVariantLines: 10,
};

describe("MarketerStateSchema", () => {
  it("accepts a minimal valid state payload", () => {
    const raw = {
      campaignName: "Test",
      voice: "",
      offer: "",
      geography: "",
      disclaimers: "",
      timezone: "UTC",
      variants: ["a", "b"],
      variantsConfirmed: true,
      schedule: [
        {
          date: "May 1",
          idea: "Launch",
          scheduledAt: "2026-05-01T12:00:00.000Z",
        },
      ],
      publishStatus: "Draft",
      firstEngagement: false,
      socialConnections: { meta: "connected" },
      branding: {},
      plan: "free",
      onboarding: sampleOnboarding,
      entitlements: sampleEntitlementsFree,
    };
    expect(() => parseMarketerState(raw)).not.toThrow();
    const parsed = parseMarketerState(raw);
    expect(parsed.variants).toHaveLength(2);
  });

  it("rejects invalid publishStatus", () => {
    const raw = {
      campaignName: "Test",
      voice: "",
      offer: "",
      geography: "",
      disclaimers: "",
      timezone: "UTC",
      variants: [],
      variantsConfirmed: false,
      schedule: [],
      publishStatus: "Unknown",
      firstEngagement: false,
      branding: {},
      plan: "free",
      onboarding: sampleOnboarding,
      entitlements: sampleEntitlementsFree,
    };
    expect(MarketerStateSchema.safeParse(raw).success).toBe(false);
  });
});

describe("MarketerWebhookPublishBodySchema", () => {
  it("requires uuid workspace", () => {
    expect(
      MarketerWebhookPublishBodySchema.safeParse({
        workspaceId: "not-a-uuid",
        publishStatus: "Published",
      }).success,
    ).toBe(false);
  });
});
