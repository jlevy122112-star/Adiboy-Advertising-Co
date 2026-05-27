ts
import { db } from '../db'; // adjust
import {
  PLAN_USAGE_LIMITS,
  type PlanTier,
  type UsageSnapshot
} from '@adiboy/contracts';

async function ensureRow(tenantId: string) {
  await db.query(`SELECT ensure_tenant_usage_row($1)`, [tenantId]);
}

export async function getTenantUsage(
  tenantId: string,
  plan: PlanTier
): Promise<UsageSnapshot> {
  await ensureRow(tenantId);

  const row = await db.one<{
    tenant_id: string;
    period_start: Date;
    ai_generations: number;
    posts_published: number;
    storage_bytes: string | number;
  }>(
    `SELECT tenant_id, period_start, ai_generations, posts_published, storage_bytes
     FROM tenant_usage
     WHERE tenant_id = $1`,
    [tenantId]
  );

  const limits = PLAN_USAGE_LIMITS[plan];

  return {
    tenantId: row.tenant_id,
    periodStart: row.period_start.toISOString(),
    aiGenerations: row.ai_generations,
    postsPublished: row.posts_published,
    storageBytes: Number(row.storage_bytes),
    limits
  };
}

async function increment(
  tenantId: string,
  delta: { ai?: number; posts?: number; bytes?: number }
) {
  await ensureRow(tenantId);

  await db.query(
    `
    UPDATE tenant_usage
    SET
      ai_generations = ai_generations + $2,
      posts_published = posts_published + $3,
      storage_bytes = storage_bytes + $4
    WHERE tenant_id = $1
    `,
    [
      tenantId,
      delta.ai ?? 0,
      delta.posts ?? 0,
      delta.bytes ?? 0
    ]
  );
}

export async function incrementAiGenerations(tenantId: string) {
  await increment(tenantId, { ai: 1 });
}

export async function incrementPostsPublished(tenantId: string) {
  await increment(tenantId, { posts: 1 });
}

export async function incrementStorageBytes(tenantId: string, bytes: number) {
  await increment(tenantId, { bytes });
}

export async function checkUsageLimit(
  tenantId: string,
  plan: PlanTier,
  metric: 'aiGenerations' | 'postsPublished' | 'storageBytes'
): Promise<{ allowed: boolean; usage: UsageSnapshot }> {
  const usage = await getTenantUsage(tenantId, plan);
  const limits = usage.limits;

  const current =
    metric === 'aiGenerations'
      ? usage.aiGenerations
      : metric === 'postsPublished'
      ? usage.postsPublished
      : usage.storageBytes;

  const limit =
    metric === 'aiGenerations'
      ? limits.aiGenerations
      : metric === 'postsPublished'
      ? limits.postsPerMonth
      : limits.storageBytes;

  if (limit === null) {
    return { allowed: true, usage };
  }

  return { allowed: current < limit, usage };
}
