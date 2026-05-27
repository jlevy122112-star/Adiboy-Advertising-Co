import { getPostgresClient } from "./postgres.js";

export type TenantUsageRow = {
  tenant_id: string;
  period_start: string;
  ai_generations: number;
  posts_published: number;
  assets_stored: number;
  storage_bytes: number;
  api_calls: number;
  updated_at: string;
};

const COLS = `tenant_id, period_start, ai_generations, posts_published, assets_stored, storage_bytes, api_calls, updated_at`;

/** PLAN LIMITS — hard caps enforced per billing period (unlimited = 999999) */
export const PLAN_USAGE_LIMITS: Record<string, {
  aiGenerations: number;
  postsPublished: number;
  storageMb: number;
}> = {
  free:       { aiGenerations: 10,     postsPublished: 5,    storageMb: 100 },
  pro:        { aiGenerations: 500,    postsPublished: 200,  storageMb: 5_000 },
  enterprise: { aiGenerations: 999999, postsPublished: 999999, storageMb: 51_200 },
};

/** Get-or-create usage row, rolling over the period if the month changed. */
export async function getTenantUsage(tenantId: string): Promise<TenantUsageRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<TenantUsageRow[]>`
    INSERT INTO tenant_usage (tenant_id)
    VALUES (${tenantId})
    ON CONFLICT (tenant_id) DO UPDATE SET
      ai_generations  = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN 0 ELSE tenant_usage.ai_generations END,
      posts_published = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN 0 ELSE tenant_usage.posts_published END,
      api_calls       = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN 0 ELSE tenant_usage.api_calls END,
      period_start    = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN date_trunc('month', now()) ELSE tenant_usage.period_start END,
      updated_at      = now()
    RETURNING ${sql.unsafe(COLS)}
  `;
  return rows[0] ?? null;
}

export async function incrementAiGenerations(tenantId: string, by = 1): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  await sql`
    INSERT INTO tenant_usage (tenant_id, ai_generations)
    VALUES (${tenantId}, ${by})
    ON CONFLICT (tenant_id) DO UPDATE SET
      ai_generations  = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN ${by} ELSE tenant_usage.ai_generations + ${by} END,
      posts_published = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN 0 ELSE tenant_usage.posts_published END,
      api_calls       = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN 0 ELSE tenant_usage.api_calls END,
      period_start    = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN date_trunc('month', now()) ELSE tenant_usage.period_start END,
      updated_at      = now()
  `;
}

export async function incrementPostsPublished(tenantId: string, by = 1): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  await sql`
    INSERT INTO tenant_usage (tenant_id, posts_published)
    VALUES (${tenantId}, ${by})
    ON CONFLICT (tenant_id) DO UPDATE SET
      posts_published = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN ${by} ELSE tenant_usage.posts_published + ${by} END,
      ai_generations  = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN 0 ELSE tenant_usage.ai_generations END,
      api_calls       = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN 0 ELSE tenant_usage.api_calls END,
      period_start    = CASE
        WHEN date_trunc('month', tenant_usage.period_start) < date_trunc('month', now())
        THEN date_trunc('month', now()) ELSE tenant_usage.period_start END,
      updated_at      = now()
  `;
}

export async function incrementAssetsStored(tenantId: string, by = 1): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  await sql`
    INSERT INTO tenant_usage (tenant_id, assets_stored)
    VALUES (${tenantId}, ${by})
    ON CONFLICT (tenant_id) DO UPDATE SET
      assets_stored = tenant_usage.assets_stored + ${by},
      updated_at    = now()
  `;
}

export async function incrementStorageBytes(tenantId: string, bytes: number): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  await sql`
    INSERT INTO tenant_usage (tenant_id, storage_bytes)
    VALUES (${tenantId}, ${bytes})
    ON CONFLICT (tenant_id) DO UPDATE SET
      storage_bytes = tenant_usage.storage_bytes + ${bytes},
      updated_at    = now()
  `;
}

/** Returns whether the tenant is at or over their monthly limit for the given metric. */
export async function checkUsageLimit(
  tenantId: string,
  plan: string,
  metric: "aiGenerations" | "postsPublished",
): Promise<{ used: number; limit: number; remaining: number; exceeded: boolean }> {
  const limits = PLAN_USAGE_LIMITS[plan] ?? PLAN_USAGE_LIMITS["free"]!;
  const limit = limits[metric];
  const row = await getTenantUsage(tenantId);
  const field = metric === "aiGenerations" ? "ai_generations" : "posts_published";
  const used = row ? Number(row[field]) : 0;
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining, exceeded: used >= limit };
}
