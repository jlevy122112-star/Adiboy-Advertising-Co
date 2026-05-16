/**
 * Postgres persistence for workspace-level branding (`workspaces` table).
 */

import { WorkspaceBrandingSchema, type WorkspaceBranding } from "@home-link/marketer-pro-contract";
import { getPostgresClient } from "./postgres.js";

function toSqlJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export type UpsertWorkspaceBrandingResult =
  | { readonly ok: true; readonly branding: WorkspaceBranding }
  | { readonly ok: false; readonly code: "no_database" | "error"; readonly message: string };

/**
 * Merge-upsert branding for a tenant. Only the supplied keys are overwritten;
 * existing keys not present in `patch` are preserved via `||` JSONB merge.
 */
export async function upsertWorkspaceBranding(
  tenantId: string,
  patch: Partial<WorkspaceBranding>,
): Promise<UpsertWorkspaceBrandingResult> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database", message: "DATABASE_URL not set." };
  }
  const patchJson = toSqlJson(patch);
  try {
    await sql`
      INSERT INTO workspaces (tenant_id, branding_json, created_at, updated_at)
      VALUES (${tenantId}, ${sql.json(patchJson)}, now(), now())
      ON CONFLICT (tenant_id) DO UPDATE
        SET branding_json = workspaces.branding_json || ${sql.json(patchJson)},
            updated_at    = now()
    `;
    const rows = await sql<{ branding_json: unknown }[]>`
      SELECT branding_json FROM workspaces WHERE tenant_id = ${tenantId} LIMIT 1
    `;
    const raw = rows[0]?.branding_json ?? {};
    const branding = WorkspaceBrandingSchema.parse(raw);
    return { ok: true, branding };
  } catch (e) {
    return { ok: false, code: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export type GetWorkspaceBrandingResult =
  | { readonly ok: true; readonly branding: WorkspaceBranding }
  | { readonly ok: false; readonly code: "no_database" | "not_found" | "error"; readonly message: string };

export async function getWorkspaceBranding(
  tenantId: string,
): Promise<GetWorkspaceBrandingResult> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database", message: "DATABASE_URL not set." };
  }
  try {
    const rows = await sql<{ branding_json: unknown }[]>`
      SELECT branding_json FROM workspaces WHERE tenant_id = ${tenantId} LIMIT 1
    `;
    if (!rows[0]) {
      return { ok: false, code: "not_found", message: "workspace_not_found" };
    }
    const branding = WorkspaceBrandingSchema.parse(rows[0].branding_json);
    return { ok: true, branding };
  } catch (e) {
    return { ok: false, code: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
