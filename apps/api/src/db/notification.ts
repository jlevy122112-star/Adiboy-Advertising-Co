import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { TeamNotification, TeamNotificationType, CollabEntityType } from "@home-link/marketer-pro-contract";

interface NotificationRow {
  id: string; user_id: string; workspace_id: string; type: string;
  entity_type: string | null; entity_id: string | null;
  title: string; body: string; read_at: Date | null; created_at: Date;
}

function rowToNotification(r: NotificationRow): TeamNotification {
  return {
    id: r.id, userId: r.user_id, workspaceId: r.workspace_id,
    type: r.type as TeamNotificationType,
    entityType: (r.entity_type as CollabEntityType | null),
    entityId: r.entity_id,
    title: r.title, body: r.body,
    readAt: r.read_at ? r.read_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function createNotification(args: {
  userId: string; workspaceId: string; type: TeamNotificationType;
  entityType?: CollabEntityType; entityId?: string;
  title: string; body: string;
}): Promise<TeamNotification | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const id = randomUUID();
  try {
    const rows = await sql<NotificationRow[]>`
      INSERT INTO team_notifications
        (id, user_id, workspace_id, type, entity_type, entity_id, title, body)
      VALUES (
        ${id}, ${args.userId}, ${args.workspaceId}, ${args.type},
        ${args.entityType ?? null}, ${args.entityId ?? null},
        ${args.title}, ${args.body}
      ) RETURNING *
    `;
    return rows[0] ? rowToNotification(rows[0]) : null;
  } catch { return null; }
}

export async function listNotifications(
  userId: string, workspaceId: string, opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<TeamNotification[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const limit = opts.limit ?? 30;
  try {
    if (opts.unreadOnly) {
      return (await sql<NotificationRow[]>`
        SELECT * FROM team_notifications
        WHERE user_id = ${userId} AND workspace_id = ${workspaceId} AND read_at IS NULL
        ORDER BY created_at DESC LIMIT ${limit}
      `).map(rowToNotification);
    }
    return (await sql<NotificationRow[]>`
      SELECT * FROM team_notifications
      WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
      ORDER BY created_at DESC LIMIT ${limit}
    `).map(rowToNotification);
  } catch { return []; }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    await sql`UPDATE team_notifications SET read_at = NOW() WHERE id = ${id} AND read_at IS NULL`;
    return true;
  } catch { return false; }
}

export async function markAllNotificationsRead(userId: string, workspaceId: string): Promise<number> {
  const sql = getPostgresClient();
  if (!sql) return 0;
  try {
    const rows = await sql<{ count: string }[]>`
      UPDATE team_notifications SET read_at = NOW()
      WHERE user_id = ${userId} AND workspace_id = ${workspaceId} AND read_at IS NULL
      RETURNING id
    `;
    return rows.length;
  } catch { return 0; }
}

export async function appendChangeHistory(args: {
  workspaceId: string; entityType: CollabEntityType; entityId: string;
  actorId: string; actorName: string; action: string;
  field?: string; oldValue?: string; newValue?: string;
}): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  const id = randomUUID();
  try {
    await sql`
      INSERT INTO change_history
        (id, workspace_id, entity_type, entity_id, actor_id, actor_name, action, field, old_value, new_value)
      VALUES (
        ${id}, ${args.workspaceId}, ${args.entityType}, ${args.entityId},
        ${args.actorId}, ${args.actorName}, ${args.action},
        ${args.field ?? null}, ${args.oldValue ?? null}, ${args.newValue ?? null}
      )
    `;
  } catch { /* best-effort */ }
}

interface ChangeRow {
  id: string; workspace_id: string; entity_type: string; entity_id: string;
  actor_id: string; actor_name: string; action: string;
  field: string | null; old_value: string | null; new_value: string | null;
  created_at: Date;
}

export async function listChangeHistory(
  workspaceId: string, entityType: string, entityId: string, limit = 20,
): Promise<Array<{
  id: string; workspaceId: string; entityType: CollabEntityType; entityId: string;
  actorId: string; actorName: string; action: string;
  field: string | null; oldValue: string | null; newValue: string | null;
  createdAt: string;
}>> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<ChangeRow[]>`
      SELECT * FROM change_history
      WHERE workspace_id = ${workspaceId}
        AND entity_type = ${entityType} AND entity_id = ${entityId}
      ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows.map(r => ({
      id: r.id, workspaceId: r.workspace_id,
      entityType: r.entity_type as CollabEntityType, entityId: r.entity_id,
      actorId: r.actor_id, actorName: r.actor_name, action: r.action,
      field: r.field, oldValue: r.old_value, newValue: r.new_value,
      createdAt: r.created_at.toISOString(),
    }));
  } catch { return []; }
}
