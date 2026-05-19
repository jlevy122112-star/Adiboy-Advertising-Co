import { getPostgresClient } from "./postgres.js";

export type PlanTier = "free" | "pro" | "enterprise";

export type WorkspaceBillingRow = {
  tenant_id: string;
  plan: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_expires_at: string | null;
};

const COLS = `tenant_id, plan, stripe_customer_id, stripe_subscription_id, plan_expires_at`;

export async function getWorkspaceBilling(tenantId: string): Promise<WorkspaceBillingRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<WorkspaceBillingRow[]>`
    SELECT ${sql.unsafe(COLS)} FROM workspaces WHERE tenant_id = ${tenantId} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function upsertWorkspaceBilling(
  tenantId: string,
  patch: Partial<Omit<WorkspaceBillingRow, "tenant_id">>,
): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    await sql`
      INSERT INTO workspaces (tenant_id, plan, stripe_customer_id, stripe_subscription_id, plan_expires_at)
      VALUES (
        ${tenantId},
        ${patch.plan ?? "free"},
        ${patch.stripe_customer_id ?? null},
        ${patch.stripe_subscription_id ?? null},
        ${patch.plan_expires_at ?? null}
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        plan                   = COALESCE(EXCLUDED.plan, workspaces.plan),
        stripe_customer_id     = COALESCE(EXCLUDED.stripe_customer_id, workspaces.stripe_customer_id),
        stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, workspaces.stripe_subscription_id),
        plan_expires_at        = COALESCE(EXCLUDED.plan_expires_at, workspaces.plan_expires_at),
        updated_at             = now()
    `;
    return true;
  } catch {
    return false;
  }
}

export async function setWorkspacePlan(
  tenantId: string,
  plan: PlanTier,
  stripeSubscriptionId?: string,
  planExpiresAt?: Date,
): Promise<boolean> {
  return upsertWorkspaceBilling(tenantId, {
    plan,
    stripe_subscription_id: stripeSubscriptionId ?? null,
    plan_expires_at: planExpiresAt?.toISOString() ?? null,
  });
}

export async function getWorkspacePlan(tenantId: string): Promise<PlanTier> {
  const row = await getWorkspaceBilling(tenantId);
  return row?.plan ?? "free";
}

export async function getOrCreateStripeCustomer(
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    await sql`
      INSERT INTO workspaces (tenant_id, stripe_customer_id)
      VALUES (${tenantId}, ${customerId})
      ON CONFLICT (tenant_id) DO UPDATE SET
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        updated_at = now()
      WHERE workspaces.stripe_customer_id IS NULL
    `;
    return true;
  } catch {
    return false;
  }
}
