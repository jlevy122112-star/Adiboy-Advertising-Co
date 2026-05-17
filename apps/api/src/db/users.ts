import { getPostgresClient } from "./postgres.js";
import type { UserRole } from "@home-link/marketer-pro-contract";

export type UserRow = {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

const COLS = `id, tenant_id, email, password_hash, email_verified, role, created_at, updated_at`;

export async function insertUser(input: {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}): Promise<UserRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<UserRow[]>`
    INSERT INTO users (id, tenant_id, email, password_hash, role)
    VALUES (${input.id}, ${input.tenantId}, ${input.email.toLowerCase()}, ${input.passwordHash}, ${input.role ?? "member"})
    RETURNING ${sql.unsafe(COLS)}
  `;
  return rows[0] ?? null;
}

export async function getUserByEmail(tenantId: string, email: string): Promise<UserRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<UserRow[]>`
    SELECT ${sql.unsafe(COLS)} FROM users
    WHERE tenant_id = ${tenantId} AND email = ${email.toLowerCase()}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<UserRow[]>`
    SELECT ${sql.unsafe(COLS)} FROM users WHERE id = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  const rows = await sql`
    UPDATE users SET password_hash = ${passwordHash}, updated_at = now()
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function verifyUserEmail(id: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  const rows = await sql`
    UPDATE users SET email_verified = true, updated_at = now()
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}
