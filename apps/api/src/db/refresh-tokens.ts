import { getPostgresClient } from "./postgres.js";
import { createHash } from "node:crypto";

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function insertRefreshToken(input: {
  id: string;
  userId: string;
  tenantId: string;
  token: string;
  expiresAt: Date;
}): Promise<RefreshTokenRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const tokenHash = hashToken(input.token);
  const rows = await sql<RefreshTokenRow[]>`
    INSERT INTO refresh_tokens (id, user_id, tenant_id, token_hash, expires_at)
    VALUES (${input.id}, ${input.userId}, ${input.tenantId}, ${tokenHash}, ${input.expiresAt.toISOString()})
    RETURNING id, user_id, tenant_id, token_hash, expires_at, revoked_at, created_at
  `;
  return rows[0] ?? null;
}

export async function getRefreshToken(token: string): Promise<RefreshTokenRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const tokenHash = hashToken(token);
  const rows = await sql<RefreshTokenRow[]>`
    SELECT id, user_id, tenant_id, token_hash, expires_at, revoked_at, created_at
    FROM refresh_tokens
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > now()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function revokeRefreshToken(token: string): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  const tokenHash = hashToken(token);
  const rows = await sql`
    UPDATE refresh_tokens SET revoked_at = now()
    WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  await sql`
    UPDATE refresh_tokens SET revoked_at = now()
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;
}
