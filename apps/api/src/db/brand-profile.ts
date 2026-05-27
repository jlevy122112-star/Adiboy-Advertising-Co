/**
 * Postgres persistence for `brand_profiles` — Phase 1 brand intelligence documents.
 */

import {
  BrandIntelligenceProfileSchema,
  type BrandIntelligenceProfile,
} from "@home-link/marketer-pro-contract";

import { getPostgresClient } from "./postgres.js";

function toSqlJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export type UpsertBrandProfileResolve =
  | { readonly mode: "ok"; readonly profile: BrandIntelligenceProfile }
  | {
      readonly mode: "error";
      readonly code: "no_database" | "invalid_profile_json" | "upsert_failed";
      readonly message: string;
    };

export async function upsertBrandProfile(args: {
  readonly tenantId: string;
  readonly profile: BrandIntelligenceProfile;
}): Promise<UpsertBrandProfileResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "error", code: "no_database", message: "DATABASE_URL not set." };
  }
  if (args.tenantId !== args.profile.workspaceId) {
    return {
      mode: "error",
      code: "upsert_failed",
      message: "tenantId must match profile.workspaceId.",
    };
  }
  const profileId = args.profile.profileId;
  let bodyJson: ReturnType<typeof toSqlJson>;
  try {
    bodyJson = toSqlJson(BrandIntelligenceProfileSchema.parse(args.profile));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      mode: "error",
      code: "invalid_profile_json",
      message,
    };
  }
  try {
    await sql`
      INSERT INTO brand_profiles (tenant_id, profile_id, body, updated_at)
      VALUES (${args.tenantId}, ${profileId}, ${sql.json(bodyJson)}, now())
      ON CONFLICT (tenant_id, profile_id)
      DO UPDATE SET body = EXCLUDED.body, updated_at = now()
    `;
    const rows = await sql<{ body: unknown }[]>`
      SELECT body FROM brand_profiles
      WHERE tenant_id = ${args.tenantId} AND profile_id = ${profileId}
      LIMIT 1
    `;
    const raw = rows[0]?.body;
    const profile = BrandIntelligenceProfileSchema.parse(raw);
    return { mode: "ok", profile };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", code: "upsert_failed", message };
  }
}

export type GetBrandProfileResolve =
  | { readonly mode: "ok"; readonly profile: BrandIntelligenceProfile }
  | { readonly mode: "not_found"; readonly message?: string }
  | { readonly mode: "no_database"; readonly message?: string }
  | { readonly mode: "error"; readonly message?: string };

export async function getBrandProfile(
  tenantId: string,
  profileId: string,
): Promise<GetBrandProfileResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }
  try {
    const rows = await sql<{ body: unknown }[]>`
      SELECT body FROM brand_profiles
      WHERE tenant_id = ${tenantId} AND profile_id = ${profileId}
      LIMIT 1
    `;
    const raw = rows[0]?.body;
    if (raw == null) {
      return { mode: "not_found" };
    }
    const profile = BrandIntelligenceProfileSchema.parse(raw);
    return { mode: "ok", profile };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", message };
  }
}

// ─── MVP raw brand config (bypasses BrandIntelligenceProfile schema) ─────────
// The MVP onboarding collects simple key-value brand data (brandName, problem,
// solution, etc.) that doesn't map to the full BrandIntelligenceProfileSchema.
// These functions store/retrieve that data as-is so brand context is persisted
// across sessions and injected into every AI generation call.

export type MvpBrandConfig = {
  brandName?: string;
  brandColor?: string;
  brandWords?: string;
  businessType?: string;
  industry?: string;
  problem?: string;
  solution?: string;
  outcome?: string;
  website?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  address?: string;
  [key: string]: unknown;
};

const MVP_BRAND_PROFILE_ID = "__mvp__";

export async function upsertMvpBrandConfig(
  tenantId: string,
  config: MvpBrandConfig,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const sql = getPostgresClient();
  if (!sql) return { ok: false, reason: "no_database" };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bodyJson = JSON.parse(JSON.stringify(config)) as any;
    await sql`
      INSERT INTO brand_profiles (tenant_id, profile_id, body, updated_at)
      VALUES (${tenantId}, ${MVP_BRAND_PROFILE_ID}, ${sql.json(bodyJson)}, now())
      ON CONFLICT (tenant_id, profile_id)
      DO UPDATE SET body = EXCLUDED.body, updated_at = now()
    `;
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function getMvpBrandConfig(
  tenantId: string,
): Promise<MvpBrandConfig | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<{ body: unknown }[]>`
      SELECT body FROM brand_profiles
      WHERE tenant_id = ${tenantId} AND profile_id = ${MVP_BRAND_PROFILE_ID}
      LIMIT 1
    `;
    const raw = rows[0]?.body;
    if (raw == null || typeof raw !== "object") return null;
    return raw as MvpBrandConfig;
  } catch {
    return null;
  }
}

/** Gets the most-recently-updated brand profile for a tenant (no profileId required). */
export type GetLatestBrandProfileResolve =
  | { readonly ok: true; readonly profile: BrandIntelligenceProfile }
  | { readonly ok: false };

export async function getLatestBrandProfile(
  tenantId: string,
): Promise<GetLatestBrandProfileResolve> {
  const sql = getPostgresClient();
  if (!sql) return { ok: false };
  try {
    const rows = await sql<{ body: unknown }[]>`
      SELECT body FROM brand_profiles
      WHERE tenant_id = ${tenantId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const raw = rows[0]?.body;
    if (raw == null) return { ok: false };
    const profile = BrandIntelligenceProfileSchema.parse(raw);
    return { ok: true, profile };
  } catch {
    return { ok: false };
  }
}

export type ListBrandProfilesResolve =
  | { readonly mode: "ok"; readonly profiles: BrandIntelligenceProfile[] }
  | { readonly mode: "no_database"; readonly message?: string }
  | { readonly mode: "error"; readonly message?: string };

export async function listBrandProfilesByTenant(
  tenantId: string,
  limit: number,
): Promise<ListBrandProfilesResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }
  const lim = Math.min(Math.max(1, Math.floor(limit)), 50);
  try {
    const rows = await sql<{ body: unknown }[]>`
      SELECT body FROM brand_profiles
      WHERE tenant_id = ${tenantId}
      ORDER BY updated_at DESC
      LIMIT ${lim}
    `;
    const profiles = rows.map((r) => BrandIntelligenceProfileSchema.parse(r.body));
    return { mode: "ok", profiles };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", message };
  }
}
