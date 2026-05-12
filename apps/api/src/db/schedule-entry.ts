/**
 * Schedule row lookup for publish jobs — migrations `001` / `002` under `apps/api/db/migrations`.
 */

import type {
  PublishJobPayload,
  PublishJobResult,
} from "@home-link/marketer-pro-queue";
import { getPostgresClient } from "./postgres.js";

export interface ScheduleEntryRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly network: string | null;
  readonly status: string;
  readonly content_summary: string | null;
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
      SELECT id, tenant_id, network, status, content_summary
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
