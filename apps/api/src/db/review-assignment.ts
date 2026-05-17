import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { ReviewAssignment, ReviewStatus, CollabEntityType } from "@home-link/marketer-pro-contract";

interface AssignmentRow {
  id: string; workspace_id: string; entity_type: string; entity_id: string;
  assignee_id: string; assigner_id: string; due_at: Date | null;
  status: string; note: string | null; review_note: string | null;
  created_at: Date; updated_at: Date;
}

function rowToAssignment(r: AssignmentRow): ReviewAssignment {
  return {
    id: r.id, workspaceId: r.workspace_id,
    entityType: r.entity_type as CollabEntityType, entityId: r.entity_id,
    assigneeId: r.assignee_id, assignerId: r.assigner_id,
    dueAt: r.due_at ? r.due_at.toISOString() : null,
    status: r.status as ReviewStatus, note: r.note, reviewNote: r.review_note,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function createReviewAssignment(args: {
  workspaceId: string; entityType: CollabEntityType; entityId: string;
  assigneeId: string; assignerId: string; dueAt?: string; note?: string;
}): Promise<ReviewAssignment | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const id = randomUUID();
  try {
    const rows = await sql<AssignmentRow[]>`
      INSERT INTO review_assignments
        (id, workspace_id, entity_type, entity_id, assignee_id, assigner_id, due_at, note)
      VALUES (
        ${id}, ${args.workspaceId}, ${args.entityType}, ${args.entityId},
        ${args.assigneeId}, ${args.assignerId},
        ${args.dueAt ?? null}, ${args.note ?? null}
      ) RETURNING *
    `;
    return rows[0] ? rowToAssignment(rows[0]) : null;
  } catch { return null; }
}

export async function listReviewAssignments(
  workspaceId: string, entityType: string, entityId: string,
): Promise<ReviewAssignment[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<AssignmentRow[]>`
      SELECT * FROM review_assignments
      WHERE workspace_id = ${workspaceId}
        AND entity_type = ${entityType} AND entity_id = ${entityId}
      ORDER BY created_at DESC
    `;
    return rows.map(rowToAssignment);
  } catch { return []; }
}

export async function listAssignmentsForUser(workspaceId: string, userId: string): Promise<ReviewAssignment[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<AssignmentRow[]>`
      SELECT * FROM review_assignments
      WHERE workspace_id = ${workspaceId} AND assignee_id = ${userId}
        AND status IN ('pending', 'in_review')
      ORDER BY due_at ASC NULLS LAST, created_at DESC
    `;
    return rows.map(rowToAssignment);
  } catch { return []; }
}

export async function updateReviewAssignment(
  id: string, status: ReviewStatus, reviewNote?: string,
): Promise<ReviewAssignment | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<AssignmentRow[]>`
      UPDATE review_assignments
      SET status = ${status},
          review_note = COALESCE(${reviewNote ?? null}, review_note),
          updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    return rows[0] ? rowToAssignment(rows[0]) : null;
  } catch { return null; }
}

export async function deleteReviewAssignment(id: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    await sql`DELETE FROM review_assignments WHERE id = ${id}`;
    return true;
  } catch { return false; }
}
