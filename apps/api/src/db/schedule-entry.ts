/**
 * Schedule row lookup for publish jobs — migrations `001` / `002` under `apps/api/db/migrations`.
 */

import type { PublishJobPayload } from "@home-link/marketer-pro-queue";
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
