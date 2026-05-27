export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface PlanUsageLimits {
  aiGenerations: number | null;
  postsPerMonth: number | null;
  storageBytes: number | null;
}

export const PLAN_USAGE_LIMITS: Record<PlanTier, PlanUsageLimits> = {
  free: { aiGenerations: 200, postsPerMonth: 30, storageBytes: 5 * 1024 * 1024 * 1024 },
  pro: { aiGenerations: 2000, postsPerMonth: 300, storageBytes: 50 * 1024 * 1024 * 1024 },
  enterprise: { aiGenerations: null, postsPerMonth: null, storageBytes: null }
};
