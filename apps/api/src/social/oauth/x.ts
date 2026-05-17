import { randomBytes, createHash } from "node:crypto";

const CLIENT_ID = process.env.X_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.X_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.X_REDIRECT_URI ?? "http://localhost:8799/oauth/callback/x";

export type OAuthStartResult = { url: string; codeVerifier: string; state: string };
export type OAuthTokens = { accessToken: string; refreshToken: string | null; expiresIn: number | null; scope: string };

function pkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function startXOAuth(state: string): OAuthStartResult {
  const codeVerifier = pkceVerifier();
  const codeChallenge = pkceChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    url: `https://twitter.com/i/oauth2/authorize?${params}`,
    codeVerifier,
    state,
  };
}

export async function exchangeXCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
    client_id: CLIENT_ID,
  });

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`X token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope: string };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
    scope: data.scope,
  };
}

export async function refreshXToken(refreshToken: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`X token refresh failed: ${res.status}`);
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope: string };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
    scope: data.scope,
  };
}
