/**
 * Schedule row lookup for publish jobs — migrations `001`–`003` under `apps/api/db/migrations`.
 */

import type { ScheduleEntrySqlRow } from "@home-link/marketer-pro-contract";
import type {
  PublishJobPayload,
  PublishJobResult,
} from "@home-link/marketer-pro-queue";
import { getPostgresClient } from "./postgres.js";

/** `schedule_entries` row — matches {@link ScheduleEntrySqlRow} in contract. */
export type ScheduleEntryRow = ScheduleEntrySqlRow;

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export type ScheduleResolve =
  | { readonly mode: "no_database" }
  | { readonly mode: "not_found" }
  | { readonly mode: "error"; readonly message: string }
  | { readonly mode: "ok"; readonly row: ScheduleEntryRow };

export async function resolveScheduleEntryForPublish(
  payload: PublishJobPayload,
): Promise<ScheduleResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }

  try {
    const rows = await sql<ScheduleEntryRow[]>`
      SELECT id, tenant_id, campaign_id, network, status, content_summary, created_at, updated_at
      FROM schedule_entries
      WHERE id = ${payload.scheduleEntryId}
        AND tenant_id = ${payload.tenantId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return { mode: "not_found" };
    }
    return { mode: "ok", row };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", message };
  }
}

export type UpdateScheduleEntryCampaignResult =
  | { readonly ok: true; readonly row: ScheduleEntryRow }
  | {
      readonly ok: false;
      readonly code:
        | "no_database"
        | "not_found"
        | "campaign_not_found"
        | "foreign_key_violation"
        | "error";
      readonly message: string;
    };

/**
 * Set `schedule_entries.campaign_id` (same tenant). When `campaignId` is
 * non-null, the campaign row must exist (checked before update). `null` clears
 * the link.
 */
export async function updateScheduleEntryCampaignId(args: {
  readonly tenantId: string;
  readonly scheduleEntryId: string;
  readonly campaignId: string | null;
}): Promise<UpdateScheduleEntryCampaignResult> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database", message: "no_database" };
  }

  if (args.campaignId !== null) {
    try {
      const exists = await sql<{ one: number }[]>`
        SELECT 1 AS one FROM campaigns
        WHERE tenant_id = ${args.tenantId} AND id = ${args.campaignId}
        LIMIT 1
      `;
      if (!exists[0]) {
        return {
          ok: false,
          code: "campaign_not_found",
          message: "campaign_not_found_for_tenant",
        };
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, code: "error", message };
    }
  }

  try {
    const rows = await sql<ScheduleEntryRow[]>`
      UPDATE schedule_entries
      SET campaign_id = ${args.campaignId},
          updated_at = now()
      WHERE tenant_id = ${args.tenantId}
        AND id = ${args.scheduleEntryId}
      RETURNING id, tenant_id, campaign_id, network, status, content_summary,
                created_at, updated_at
    `;
    const row = rows[0];
    if (!row) {
      return {
        ok: false,
        code: "not_found",
        message: "schedule_entry_not_found",
      };
    }
    return { ok: true, row };
  } catch (e) {
    if (pgErrorCode(e) === "23503") {
      return {
        ok: false,
        code: "foreign_key_violation",
        message: "schedule_entries_campaign_fk_violation",
      };
    }
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "error", message };
  }
}

export type ListScheduleEntriesForCampaignResult =
  | { readonly mode: "no_database" }
  | { readonly mode: "error"; readonly message: string }
  | { readonly mode: "ok"; readonly rows: ScheduleEntryRow[] };

/**
 * List `schedule_entries` rows for a tenant where `campaign_id` matches (Phase 4
 * calendar — “entries in this campaign”), newest `updated_at` first.
 */
export async function listScheduleEntriesForCampaign(args: {
  readonly tenantId: string;
  readonly campaignId: string;
  readonly limit: number;
}): Promise<ListScheduleEntriesForCampaignResult> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }
  try {
    const rows = await sql<ScheduleEntryRow[]>`
      SELECT id, tenant_id, campaign_id, network, status, content_summary, created_at, updated_at
      FROM schedule_entries
      WHERE tenant_id = ${args.tenantId}
        AND campaign_id = ${args.campaignId}
      ORDER BY updated_at DESC
      LIMIT ${args.limit}
    `;
    return { mode: "ok", rows };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", message };
  }
}

export type SchedulePublishPersistPlan =
  | { readonly action: "skip"; readonly reason: string }
  | { readonly action: "update"; readonly status: "published" | "failed" };

/**
 * Decide whether to touch `schedule_entries` after a publish attempt.
 * Skips when the row was never loaded (not found / read error) so we do not
 * write under ambiguous DB health.
 */
export function planScheduleEntryPublishPersist(
  result: PublishJobResult,
): SchedulePublishPersistPlan {
  const detail = result.detail ?? "";
  if (detail.startsWith("postgres_query_failed")) {
    return { action: "skip", reason: "postgres_read_error" };
  }
  if (detail === "schedule_entry_not_found_in_postgres") {
    return { action: "skip", reason: "not_found" };
  }
  if (result.ok) {
    return { action: "update", status: "published" };
  }
  return { action: "update", status: "failed" };
}

/** Best-effort status sync after publish — failures are swallowed (logs only). */
export async function persistScheduleEntryPublishOutcome(
  payload: PublishJobPayload,
  result: PublishJobResult,
): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) {
    return;
  }
  const plan = planScheduleEntryPublishPersist(result);
  if (plan.action === "skip") {
    return;
  }
  try {
    await sql`
      UPDATE schedule_entries
      SET status = ${plan.status},
          updated_at = now()
      WHERE tenant_id = ${payload.tenantId}
        AND id = ${payload.scheduleEntryId}
    `;
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "schedule_entry_persist_failed",
        tenantId: payload.tenantId,
        scheduleEntryId: payload.scheduleEntryId,
        message: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}
