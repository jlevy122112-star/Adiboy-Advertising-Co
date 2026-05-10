export type MarketerPlan = "free" | "pro" | "enterprise";

/**
 * How rich the analytics surface is for this plan. Free gets just the
 * essentials (was it published? did it deliver?). Pro adds engagement
 * metrics and per-post breakdowns. Enterprise adds cohort/cross-network
 * comparisons and scheduled exports.
 */
export type AnalyticsDepth = "basic" | "standard" | "advanced";

export interface MarketerEntitlements {
  /** Max calendar window the user can schedule into. */
  maxScheduleDays: number;
  canUseAiGenerate: boolean;
  canLivePublish: boolean;
  /** Pro/Enterprise gate for full autonomous mode. */
  canUseAutonomousMode: boolean;
  maxVariantLines: number;
  /**
   * Max connected social accounts per network (e.g. how many Instagram
   * pages a workspace can hook up). Free is intentionally tight to
   * encourage upgrades for multi-brand or agency users.
   */
  maxSocialConnectionsPerNetwork: number;
  /** See {@link AnalyticsDepth}. Future versions deepen the upper tiers. */
  analyticsDepth: AnalyticsDepth;
}

export function marketerEntitlementsForPlan(
  plan: MarketerPlan,
): MarketerEntitlements {
  switch (plan) {
    case "free":
      return {
        maxScheduleDays: 7,
        canUseAiGenerate: false,
        canLivePublish: false,
        canUseAutonomousMode: false,
        maxVariantLines: 10,
        maxSocialConnectionsPerNetwork: 1,
        analyticsDepth: "basic",
      };
    case "pro":
      return {
        maxScheduleDays: 30,
        canUseAiGenerate: true,
        canLivePublish: true,
        canUseAutonomousMode: true,
        maxVariantLines: 80,
        maxSocialConnectionsPerNetwork: 5,
        analyticsDepth: "standard",
      };
    case "enterprise":
      return {
        maxScheduleDays: 60,
        canUseAiGenerate: true,
        canLivePublish: true,
        canUseAutonomousMode: true,
        maxVariantLines: 80,
        maxSocialConnectionsPerNetwork: 50,
        analyticsDepth: "advanced",
      };
    default: {
      const _exhaustive: never = plan;
      return _exhaustive;
    }
  }
}
