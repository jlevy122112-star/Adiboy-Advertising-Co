import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { Approval, ApprovalStatus, CollabEntityType } from "@home-link/marketer-pro-contract";

interface ApprovalRow {
  id: string; workspace_id: string; entity_type: string; entity_id: string;
  step: number; reviewer_id: string; status: string;
  comment: string | null; decided_at: Date | null;
  created_at: Date; updated_at: Date;
}

function rowToApproval(r: ApprovalRow): Approval {
  return {
    id: r.id, workspaceId: r.workspace_id,
    entityType: r.entity_type as CollabEntityType, entityId: r.entity_id,
    step: r.step, reviewerId: r.reviewer_id, status: r.status as ApprovalStatus,
    comment: r.comment,
    decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function createApprovals(args: {
  workspaceId: string; entityType: CollabEntityType; entityId: string;
  reviewerIds: string[];
}): Promise<Approval[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const results: Approval[] = [];
  for (let i = 0; i < args.reviewerIds.length; i++) {
    const id = randomUUID();
    try {
      const rows = await sql<ApprovalRow[]>`
        INSERT INTO approvals (id, workspace_id, entity_type, entity_id, step, reviewer_id)
        VALUES (${id}, ${args.workspaceId}, ${args.entityType}, ${args.entityId}, ${i + 1}, ${args.reviewerIds[i]!})
        RETURNING *
      `;
      if (rows[0]) results.push(rowToApproval(rows[0]));
    } catch { /* best-effort */ }
  }
  return results;
}

export async function listApprovals(
  workspaceId: string, entityType: string, entityId: string,
): Promise<Approval[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<ApprovalRow[]>`
      SELECT * FROM approvals
      WHERE workspace_id = ${workspaceId}
        AND entity_type = ${entityType} AND entity_id = ${entityId}
      ORDER BY step ASC
    `;
    return rows.map(rowToApproval);
  } catch { return []; }
}

export async function listPendingApprovalsForUser(workspaceId: string, reviewerId: string): Promise<Approval[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<ApprovalRow[]>`
      SELECT * FROM approvals
      WHERE workspace_id = ${workspaceId} AND reviewer_id = ${reviewerId} AND status = 'pending'
      ORDER BY created_at ASC
    `;
    return rows.map(rowToApproval);
  } catch { return []; }
}

export async function decideApproval(
  id: string, status: ApprovalStatus, comment?: string,
): Promise<Approval | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<ApprovalRow[]>`
      UPDATE approvals
      SET status = ${status},
          comment = ${comment ?? null},
          decided_at = NOW(),
          updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    return rows[0] ? rowToApproval(rows[0]) : null;
  } catch { return null; }
}
