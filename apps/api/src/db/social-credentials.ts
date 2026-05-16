/**
 * Credential lookup for outbound social publishing (Phase 5).
 * Reads from `social_credentials` (migration 008).
 */

import { getPostgresClient } from "./postgres.js";

export type SocialCredentialRow = {
  readonly tenant_id: string;
  readonly network: string;
  readonly access_token: string;
  readonly token_secret: string | null;
  readonly expires_at: string | Date | null;
  readonly metadata: Record<string, unknown>;
};

export type LookupCredentialResult =
  | { readonly mode: "no_database" }
  | { readonly mode: "not_found" }
  | { readonly mode: "error"; readonly message: string }
  | { readonly mode: "ok"; readonly row: SocialCredentialRow };

/**
 * Fetch the stored OAuth credential for a (tenant, network) pair.
 * Returns `not_found` when no row exists — callers should fall back to stub
 * behaviour rather than hard-failing the publish job.
 */
export async function lookupSocialCredential(
  tenantId: string,
  network: string,
): Promise<LookupCredentialResult> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }
  try {
    const rows = await sql<SocialCredentialRow[]>`
      SELECT tenant_id, network, access_token, token_secret, expires_at, metadata
      FROM social_credentials
      WHERE tenant_id = ${tenantId}
        AND network   = ${network}
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

export type UpsertCredentialInput = {
  readonly tenantId: string;
  readonly network: string;
  readonly accessToken: string;
  readonly tokenSecret?: string | null;
  readonly expiresAt?: string | null;
  readonly metadata?: Record<string, unknown>;
};

export type UpsertCredentialResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "no_database" | "error"; readonly message: string };

/** Insert or replace a credential row (used by OAuth callback handlers). */
export async function upsertSocialCredential(
  input: UpsertCredentialInput,
): Promise<UpsertCredentialResult> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database", message: "DATABASE_URL not set." };
  }
  const meta = JSON.stringify(input.metadata ?? {});
  try {
    await sql`
      INSERT INTO social_credentials
        (tenant_id, network, access_token, token_secret, expires_at, metadata, updated_at)
      VALUES
        (${input.tenantId}, ${input.network}, ${input.accessToken},
         ${input.tokenSecret ?? null}, ${input.expiresAt ?? null}::timestamptz,
         ${meta}::jsonb, now())
      ON CONFLICT (tenant_id, network) DO UPDATE
        SET access_token = EXCLUDED.access_token,
            token_secret = EXCLUDED.token_secret,
            expires_at   = EXCLUDED.expires_at,
            metadata     = EXCLUDED.metadata,
            updated_at   = now()
    `;
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "error", message };
  }
}
