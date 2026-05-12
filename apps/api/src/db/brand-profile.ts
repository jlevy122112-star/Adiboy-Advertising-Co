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
