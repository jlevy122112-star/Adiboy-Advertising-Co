import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { WorkspaceMember, WorkspaceRole } from "@home-link/marketer-pro-contract";

interface MemberRow {
  id: string; workspace_id: string; user_id: string; email: string;
  display_name: string; role: string; status: string;
  invited_by: string | null; invited_at: Date; joined_at: Date | null;
  created_at: Date; updated_at: Date;
}

function rowToMember(r: MemberRow): WorkspaceMember {
  return {
    id: r.id, workspaceId: r.workspace_id, userId: r.user_id,
    email: r.email, displayName: r.display_name,
    role: r.role as WorkspaceRole, status: r.status as WorkspaceMember["status"],
    invitedBy: r.invited_by,
    invitedAt: r.invited_at.toISOString(),
    joinedAt: r.joined_at ? r.joined_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function upsertWorkspaceMember(args: {
  workspaceId: string; userId: string; email: string;
  displayName: string; role: WorkspaceRole; status: WorkspaceMember["status"];
  invitedBy?: string | null;
}): Promise<WorkspaceMember | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const now = new Date().toISOString();
  const id = randomUUID();
  try {
    const rows = await sql<MemberRow[]>`
      INSERT INTO workspace_members
        (id, workspace_id, user_id, email, display_name, role, status, invited_by, invited_at, joined_at)
      VALUES (
        ${id}, ${args.workspaceId}, ${args.userId}, ${args.email},
        ${args.displayName}, ${args.role}, ${args.status},
        ${args.invitedBy ?? null}, ${now},
        ${args.status === "active" ? now : null}
      )
      ON CONFLICT (workspace_id, user_id) DO UPDATE
        SET role = EXCLUDED.role,
            status = EXCLUDED.status,
            display_name = EXCLUDED.display_name,
            updated_at = NOW()
      RETURNING *
    `;
    return rows[0] ? rowToMember(rows[0]) : null;
  } catch { return null; }
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<MemberRow[]>`
      SELECT * FROM workspace_members WHERE workspace_id = ${workspaceId}
      ORDER BY role, display_name
    `;
    return rows.map(rowToMember);
  } catch { return []; }
}

export async function getWorkspaceMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<MemberRow[]>`
      SELECT * FROM workspace_members WHERE workspace_id = ${workspaceId} AND user_id = ${userId}
    `;
    return rows[0] ? rowToMember(rows[0]) : null;
  } catch { return null; }
}

export async function updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMember | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<MemberRow[]>`
      UPDATE workspace_members SET role = ${role}, updated_at = NOW()
      WHERE workspace_id = ${workspaceId} AND user_id = ${userId}
      RETURNING *
    `;
    return rows[0] ? rowToMember(rows[0]) : null;
  } catch { return null; }
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    await sql`DELETE FROM workspace_members WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`;
    return true;
  } catch { return false; }
}

export async function activateMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<MemberRow[]>`
      UPDATE workspace_members
      SET status = 'active', joined_at = COALESCE(joined_at, NOW()), updated_at = NOW()
      WHERE workspace_id = ${workspaceId} AND user_id = ${userId}
      RETURNING *
    `;
    return rows[0] ? rowToMember(rows[0]) : null;
  } catch { return null; }
}
