import { describe, expect, it } from "vitest";
import { marketerEntitlementsForPlan } from "./plan-entitlements.js";

describe("marketerEntitlementsForPlan", () => {
  it("gives free tier a short calendar and no live publish", () => {
    const e = marketerEntitlementsForPlan("free");
    expect(e.maxScheduleDays).toBe(7);
    expect(e.canLivePublish).toBe(false);
    expect(e.canUseAiGenerate).toBe(false);
    expect(e.maxVariantLines).toBe(10);
  });

  it("gives pro tier full calendar and publishing", () => {
    const e = marketerEntitlementsForPlan("pro");
    expect(e.maxScheduleDays).toBe(30);
    expect(e.canLivePublish).toBe(true);
    expect(e.canUseAiGenerate).toBe(true);
  });

  it("extends enterprise calendar beyond pro", () => {
    const e = marketerEntitlementsForPlan("enterprise");
    expect(e.maxScheduleDays).toBe(60);
    expect(e.canLivePublish).toBe(true);
  });
});
