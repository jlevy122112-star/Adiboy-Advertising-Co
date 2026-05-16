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
  readonly refresh_token: string | null;
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
      SELECT tenant_id, network, access_token, token_secret, refresh_token, expires_at, metadata
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
  readonly refreshToken?: string | null;
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
        (tenant_id, network, access_token, token_secret, refresh_token, expires_at, metadata, updated_at)
      VALUES
        (${input.tenantId}, ${input.network}, ${input.accessToken},
         ${input.tokenSecret ?? null}, ${input.refreshToken ?? null},
         ${input.expiresAt ?? null}::timestamptz, ${meta}::jsonb, now())
      ON CONFLICT (tenant_id, network) DO UPDATE
        SET access_token  = EXCLUDED.access_token,
            token_secret  = EXCLUDED.token_secret,
            refresh_token = EXCLUDED.refresh_token,
            expires_at    = EXCLUDED.expires_at,
            metadata      = EXCLUDED.metadata,
            updated_at    = now()
    `;
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "error", message };
  }
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * True when the credential row has an expires_at that is within 5 minutes of now.
 * Callers should attempt a refresh before the next publish attempt.
 */
export function isTokenExpiredOrExpiringSoon(row: SocialCredentialRow): boolean {
  if (!row.expires_at) return false
  const expiresMs = new Date(row.expires_at).getTime()
  return expiresMs - Date.now() < 5 * 60 * 1000
}

type TokenRefreshConfig = {
  /** OAuth 2.0 token endpoint for the network */
  tokenUrl: string
  clientId: string
  clientSecret: string
}

function getRefreshConfig(network: string): TokenRefreshConfig | undefined {
  switch (network) {
    case "x":
      return {
        tokenUrl: "https://api.twitter.com/2/oauth2/token",
        clientId: process.env.MARKETER_X_CLIENT_ID?.trim() ?? "",
        clientSecret: process.env.MARKETER_X_CLIENT_SECRET?.trim() ?? "",
      }
    case "linkedin":
      return {
        tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
        clientId: process.env.MARKETER_LINKEDIN_CLIENT_ID?.trim() ?? "",
        clientSecret: process.env.MARKETER_LINKEDIN_CLIENT_SECRET?.trim() ?? "",
      }
    case "instagram":
    case "meta":
      return {
        tokenUrl: "https://graph.facebook.com/oauth/access_token",
        clientId: process.env.MARKETER_META_APP_ID?.trim() ?? "",
        clientSecret: process.env.MARKETER_META_APP_SECRET?.trim() ?? "",
      }
    case "youtube":
      return {
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId: process.env.MARKETER_YOUTUBE_CLIENT_ID?.trim() ?? "",
        clientSecret: process.env.MARKETER_YOUTUBE_CLIENT_SECRET?.trim() ?? "",
      }
    default:
      return undefined
  }
}

export type RefreshTokenResult =
  | { ok: true; accessToken: string; expiresAt: string | null; refreshToken: string | null }
  | { ok: false; reason: "no_refresh_token" | "no_client_config" | "api_error" | "no_database"; message: string }

/**
 * Attempt to refresh the stored OAuth 2.0 access token for a (tenant, network) pair.
 * On success, upserts the new token back to social_credentials and returns the new value.
 * On failure, returns a structured error — callers decide whether to abort or continue with the stale token.
 */
export async function refreshSocialCredential(
  tenantId: string,
  network: string,
): Promise<RefreshTokenResult> {
  const credResult = await lookupSocialCredential(tenantId, network)
  if (credResult.mode !== "ok") {
    return { ok: false, reason: "no_database", message: `lookup_mode:${credResult.mode}` }
  }

  const row = credResult.row
  if (!row.refresh_token) {
    return { ok: false, reason: "no_refresh_token", message: "No refresh_token stored for this credential." }
  }

  const config = getRefreshConfig(network)
  if (!config || !config.clientId || !config.clientSecret) {
    return {
      ok: false,
      reason: "no_client_config",
      message: `Missing client_id/client_secret env vars for network=${network}. See MARKETER_${network.toUpperCase()}_CLIENT_ID/SECRET.`,
    }
  }

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    })

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

    if (!res.ok || typeof json["access_token"] !== "string") {
      const detail = typeof json["error_description"] === "string"
        ? json["error_description"]
        : `http_${res.status}`
      return { ok: false, reason: "api_error", message: detail }
    }

    const newAccessToken = json["access_token"] as string
    const newRefreshToken = typeof json["refresh_token"] === "string" ? json["refresh_token"] : row.refresh_token
    const expiresInSec = typeof json["expires_in"] === "number" ? json["expires_in"] : null
    const expiresAt = expiresInSec
      ? new Date(Date.now() + expiresInSec * 1000).toISOString()
      : null

    await upsertSocialCredential({
      tenantId,
      network,
      accessToken: newAccessToken,
      tokenSecret: row.token_secret,
      refreshToken: newRefreshToken,
      expiresAt,
      metadata: row.metadata,
    })

    return { ok: true, accessToken: newAccessToken, expiresAt, refreshToken: newRefreshToken }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: "api_error", message }
  }
}
