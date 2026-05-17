import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { Comment, CollabEntityType } from "@home-link/marketer-pro-contract";

interface CommentRow {
  id: string; workspace_id: string; entity_type: string; entity_id: string;
  author_id: string; author_name: string; body: string;
  parent_id: string | null; edited_at: Date | null; deleted_at: Date | null;
  created_at: Date; updated_at: Date;
}

function rowToComment(r: CommentRow): Comment {
  return {
    id: r.id, workspaceId: r.workspace_id,
    entityType: r.entity_type as CollabEntityType, entityId: r.entity_id,
    authorId: r.author_id, authorName: r.author_name, body: r.body,
    parentId: r.parent_id,
    editedAt: r.edited_at ? r.edited_at.toISOString() : null,
    deletedAt: r.deleted_at ? r.deleted_at.toISOString() : null,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function createComment(args: {
  workspaceId: string; entityType: CollabEntityType; entityId: string;
  authorId: string; authorName: string; body: string; parentId?: string;
}): Promise<Comment | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const id = randomUUID();
  try {
    const rows = await sql<CommentRow[]>`
      INSERT INTO collab_comments
        (id, workspace_id, entity_type, entity_id, author_id, author_name, body, parent_id)
      VALUES (
        ${id}, ${args.workspaceId}, ${args.entityType}, ${args.entityId},
        ${args.authorId}, ${args.authorName}, ${args.body},
        ${args.parentId ?? null}
      ) RETURNING *
    `;
    return rows[0] ? rowToComment(rows[0]) : null;
  } catch { return null; }
}

export async function listComments(
  workspaceId: string, entityType: string, entityId: string,
): Promise<Comment[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<CommentRow[]>`
      SELECT * FROM collab_comments
      WHERE workspace_id = ${workspaceId}
        AND entity_type = ${entityType} AND entity_id = ${entityId}
        AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;
    return rows.map(rowToComment);
  } catch { return []; }
}

export async function updateComment(id: string, body: string): Promise<Comment | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<CommentRow[]>`
      UPDATE collab_comments
      SET body = ${body}, edited_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;
    return rows[0] ? rowToComment(rows[0]) : null;
  } catch { return null; }
}

export async function deleteComment(id: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    await sql`UPDATE collab_comments SET deleted_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
    return true;
  } catch { return false; }
}
