import { describe, expect, it } from "vitest";
import { marketerEntitlementsForPlan } from "./plan-entitlements.js";

describe("marketerEntitlementsForPlan", () => {
  describe("free", () => {
    const e = marketerEntitlementsForPlan("free");

    it("gives a short calendar and no live publish", () => {
      expect(e.maxScheduleDays).toBe(7);
      expect(e.canLivePublish).toBe(false);
      expect(e.canUseAiGenerate).toBe(false);
      expect(e.maxVariantLines).toBe(10);
    });

    it("does not allow autonomous mode", () => {
      expect(e.canUseAutonomousMode).toBe(false);
    });

    it("ships only basic analytics", () => {
      expect(e.analyticsDepth).toBe("basic");
    });

    it("caps social connections to one per network", () => {
      expect(e.maxSocialConnectionsPerNetwork).toBe(1);
    });
  });

  describe("pro", () => {
    const e = marketerEntitlementsForPlan("pro");

    it("gives full calendar + AI + publishing", () => {
      expect(e.maxScheduleDays).toBe(30);
      expect(e.canLivePublish).toBe(true);
      expect(e.canUseAiGenerate).toBe(true);
    });

    it("unlocks autonomous mode", () => {
      expect(e.canUseAutonomousMode).toBe(true);
    });

    it("ships standard analytics depth", () => {
      expect(e.analyticsDepth).toBe("standard");
    });

    it("allows several connections per network", () => {
      expect(e.maxSocialConnectionsPerNetwork).toBe(5);
    });
  });

  describe("enterprise", () => {
    const e = marketerEntitlementsForPlan("enterprise");

    it("extends the calendar window beyond pro", () => {
      expect(e.maxScheduleDays).toBe(60);
      expect(e.canLivePublish).toBe(true);
    });

    it("unlocks autonomous mode", () => {
      expect(e.canUseAutonomousMode).toBe(true);
    });

    it("ships the deepest analytics", () => {
      expect(e.analyticsDepth).toBe("advanced");
    });

    it("allows many connections per network for multi-brand / agency use", () => {
      expect(e.maxSocialConnectionsPerNetwork).toBeGreaterThanOrEqual(50);
    });
  });

  it("only exposes autonomous mode at pro and above", () => {
    expect(marketerEntitlementsForPlan("free").canUseAutonomousMode).toBe(false);
    expect(marketerEntitlementsForPlan("pro").canUseAutonomousMode).toBe(true);
    expect(marketerEntitlementsForPlan("enterprise").canUseAutonomousMode).toBe(
      true,
    );
  });

  it("scales analytics depth monotonically with tier", () => {
    const depths = ["basic", "standard", "advanced"] as const;
    expect(depths.indexOf(marketerEntitlementsForPlan("pro").analyticsDepth)).toBeGreaterThan(
      depths.indexOf(marketerEntitlementsForPlan("free").analyticsDepth),
    );
    expect(
      depths.indexOf(marketerEntitlementsForPlan("enterprise").analyticsDepth),
    ).toBeGreaterThan(
      depths.indexOf(marketerEntitlementsForPlan("pro").analyticsDepth),
    );
  });
});
