/**
 * Postgres persistence for `campaigns` — Phase 4 tenant-scoped campaign container.
 */

import {
  campaignRecordFromSqlRow,
  type CampaignRecord,
  type CampaignSqlRow,
} from "@home-link/marketer-pro-contract";

import { getPostgresClient } from "./postgres.js";

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export type CampaignResolve =
  | { readonly mode: "no_database" }
  | { readonly mode: "not_found" }
  | { readonly mode: "error"; readonly message: string }
  | { readonly mode: "ok"; readonly row: CampaignRecord };

export async function resolveCampaign(
  tenantId: string,
  campaignId: string,
): Promise<CampaignResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }
  try {
    const rows = await sql<CampaignSqlRow[]>`
      SELECT id, tenant_id, name, status, created_at, updated_at
      FROM campaigns
      WHERE tenant_id = ${tenantId} AND id = ${campaignId}
      LIMIT 1
    `;
    const raw = rows[0];
    if (!raw) {
      return { mode: "not_found" };
    }
    return { mode: "ok", row: campaignRecordFromSqlRow(raw) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", message };
  }
}

export type ListCampaignsResolve =
  | { readonly mode: "no_database" }
  | { readonly mode: "error"; readonly message: string }
  | { readonly mode: "ok"; readonly rows: readonly CampaignRecord[] };

export async function listCampaignsByTenant(
  tenantId: string,
  limit: number,
): Promise<ListCampaignsResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }
  const lim = Math.min(Math.max(1, Math.floor(limit)), 100);
  try {
    const rows = await sql<CampaignSqlRow[]>`
      SELECT id, tenant_id, name, status, created_at, updated_at
      FROM campaigns
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${lim}
    `;
    return {
      mode: "ok",
      rows: rows.map((r) => campaignRecordFromSqlRow(r)),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", message };
  }
}

export type InsertCampaignResolve =
  | { readonly mode: "ok"; readonly record: CampaignRecord }
  | {
      readonly mode: "error";
      readonly code: "no_database" | "duplicate" | "insert_failed";
      readonly message: string;
    };

export async function insertCampaign(row: {
  readonly tenantId: string;
  readonly campaignId: string;
  readonly name: string;
  readonly status: string;
}): Promise<InsertCampaignResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "error", code: "no_database", message: "no_database" };
  }
  try {
    const rows = await sql<CampaignSqlRow[]>`
      INSERT INTO campaigns (tenant_id, id, name, status)
      VALUES (${row.tenantId}, ${row.campaignId}, ${row.name}, ${row.status})
      RETURNING id, tenant_id, name, status, created_at, updated_at
    `;
    const raw = rows[0];
    if (!raw) {
      return {
        mode: "error",
        code: "insert_failed",
        message: "insert_returned_no_row",
      };
    }
    return { mode: "ok", record: campaignRecordFromSqlRow(raw) };
  } catch (e) {
    if (pgErrorCode(e) === "23505") {
      return {
        mode: "error",
        code: "duplicate",
        message: "campaign_id_exists_for_tenant",
      };
    }
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", code: "insert_failed", message };
  }
}
