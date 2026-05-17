import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { AccountDeletionRequest, DeletionStatus } from "@home-link/marketer-pro-contract";

interface DeletionRow {
  id: string; workspace_id: string; requested_by_user_id: string;
  reason: string | null; status: string; scheduled_at: Date;
  completed_at: Date | null; created_at: Date; updated_at: Date;
}

function rowToRequest(r: DeletionRow): AccountDeletionRequest {
  return {
    id: r.id, workspaceId: r.workspace_id, requestedByUserId: r.requested_by_user_id,
    reason: r.reason, status: r.status as DeletionStatus,
    scheduledAt: r.scheduled_at.toISOString(),
    completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function createDeletionRequest(args: {
  workspaceId: string; requestedByUserId: string;
  reason?: string; scheduleDelayHours?: number;
}): Promise<AccountDeletionRequest | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const id = randomUUID();
  const delayHours = args.scheduleDelayHours ?? 72;
  const scheduledAt = new Date(Date.now() + delayHours * 3_600_000).toISOString();
  try {
    const rows = await sql<DeletionRow[]>`
      INSERT INTO account_deletion_requests
        (id, workspace_id, requested_by_user_id, reason, scheduled_at)
      VALUES (${id}, ${args.workspaceId}, ${args.requestedByUserId}, ${args.reason ?? null}, ${scheduledAt})
      ON CONFLICT (workspace_id) DO UPDATE
        SET reason = EXCLUDED.reason, scheduled_at = EXCLUDED.scheduled_at,
            status = 'requested', updated_at = NOW()
      RETURNING *
    `;
    return rows[0] ? rowToRequest(rows[0]) : null;
  } catch { return null; }
}

export async function getDeletionRequest(workspaceId: string): Promise<AccountDeletionRequest | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<DeletionRow[]>`
      SELECT * FROM account_deletion_requests WHERE workspace_id = ${workspaceId}
    `;
    return rows[0] ? rowToRequest(rows[0]) : null;
  } catch { return null; }
}

export async function cancelDeletionRequest(workspaceId: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    await sql`
      DELETE FROM account_deletion_requests
      WHERE workspace_id = ${workspaceId} AND status = 'requested'
    `;
    return true;
  } catch { return false; }
}

export async function completeDeletion(workspaceId: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    await sql`
      UPDATE account_deletion_requests
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE workspace_id = ${workspaceId}
    `;
    return true;
  } catch { return false; }
}
