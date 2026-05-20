/**
 * TikTok OAuth 2.0 (Authorization Code + PKCE).
 *
 * Partner scopes requested:
 *   user.info.basic         — display name, avatar (required by TikTok for all apps)
 *   video.upload            — upload video files
 *   video.publish           — publish videos to feed
 *   video.list              — read user's published video stats (analytics)
 *
 * Creative Partner + Content Management Partner category.
 * API reference: https://developers.tiktok.com/doc/oauth-user-access-token-management
 */

import { randomBytes, createHash } from "node:crypto";

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY ?? "";
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI ?? "http://localhost:8799/oauth/callback/tiktok";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";

export type OAuthStartResult = { url: string; codeVerifier: string; state: string };
export type OAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  openId: string;
  scope: string;
};

function pkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

const SCOPES = [
  "user.info.basic",
  "video.upload",
  "video.publish",
  "video.list",
].join(",");

export function startTikTokOAuth(state: string): OAuthStartResult {
  const codeVerifier = pkceVerifier();
  const codeChallenge = pkceChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_key: CLIENT_KEY,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return { url: `${AUTH_URL}?${params}`, codeVerifier, state };
}

export async function exchangeTikTokCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_key: CLIENT_KEY,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`TikTok token exchange failed: ${res.status}`);

  const data = await res.json() as {
    data?: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      open_id: string;
      scope: string;
    };
    error?: { code: string; message: string };
  };

  if (data.error) throw new Error(`TikTok token error: ${data.error.message}`);
  if (!data.data) throw new Error("TikTok token response missing data");

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token ?? null,
    expiresIn: data.data.expires_in ?? null,
    openId: data.data.open_id,
    scope: data.data.scope,
  };
}

export async function refreshTikTokToken(refreshToken: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_key: CLIENT_KEY,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`TikTok token refresh failed: ${res.status}`);

  const data = await res.json() as {
    data?: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      open_id: string;
      scope: string;
    };
    error?: { code: string; message: string };
  };

  if (data.error) throw new Error(`TikTok refresh error: ${data.error.message}`);
  if (!data.data) throw new Error("TikTok refresh response missing data");

  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token ?? null,
    expiresIn: data.data.expires_in ?? null,
    openId: data.data.open_id,
    scope: data.data.scope,
  };
}

export async function revokeTikTokToken(accessToken: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${accessToken}`,
    },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      token: accessToken,
    }).toString(),
  }).catch(() => { /* best effort */ });
}
