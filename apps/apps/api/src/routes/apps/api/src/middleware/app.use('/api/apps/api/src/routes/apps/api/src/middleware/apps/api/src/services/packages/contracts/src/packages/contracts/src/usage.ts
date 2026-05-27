ts
export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface PlanUsageLimits {
  aiGenerations: number | null;
  postsPerMonth: number | null;
  storageBytes: number | null;
}

export const PLAN_USAGE_LIMITS: Record<PlanTier, PlanUsageLimits> = {
  free: {
    aiGenerations: 200,
    postsPerMonth: 30,
    storageBytes: 5 * 1024 * 1024 * 1024 // 5 GB
  },
  pro: {
    aiGenerations: 2000,
    postsPerMonth: 300,
    storageBytes: 50 * 1024 * 1024 * 1024 // 50 GB
  },
  enterprise: {
    aiGenerations: null,
    postsPerMonth: null,
    storageBytes: null
  }
};

export interface UsageSnapshot {
  tenantId: string;
  periodStart: string; // ISO
  aiGenerations: number;
  postsPublished: number;
  storageBytes: number;
  limits: PlanUsageLimits;
}
