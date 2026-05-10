export type MarketerPlan = "free" | "pro" | "enterprise";

export function marketerEntitlementsForPlan(plan: MarketerPlan): {
  maxScheduleDays: number;
  canUseAiGenerate: boolean;
  canLivePublish: boolean;
  maxVariantLines: number;
} {
  switch (plan) {
    case "free":
      return {
        maxScheduleDays: 7,
        canUseAiGenerate: false,
        canLivePublish: false,
        maxVariantLines: 10,
      };
    case "pro":
      return {
        maxScheduleDays: 30,
        canUseAiGenerate: true,
        canLivePublish: true,
        maxVariantLines: 80,
      };
    case "enterprise":
      return {
        maxScheduleDays: 60,
        canUseAiGenerate: true,
        canLivePublish: true,
        maxVariantLines: 80,
      };
    default: {
      const _exhaustive: never = plan;
      return _exhaustive;
    }
  }
}
