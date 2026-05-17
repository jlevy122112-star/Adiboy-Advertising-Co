import { randomBytes, createHash } from "node:crypto";

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI ?? "http://localhost:8799/oauth/callback/youtube";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type OAuthStartResult = { url: string; codeVerifier: string; state: string };
export type OAuthTokens = { accessToken: string; refreshToken: string | null; expiresIn: number | null };

function pkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function startYouTubeOAuth(state: string): OAuthStartResult {
  const codeVerifier = pkceVerifier();
  const codeChallenge = pkceChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
    state,
    access_type: "offline",
    prompt: "consent",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return { url: `${AUTH_URL}?${params}`, codeVerifier, state };
}

export async function exchangeYouTubeCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`YouTube token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
  };
}

export async function refreshYouTubeToken(refreshToken: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`YouTube token refresh failed: ${res.status}`);
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in ?? null,
  };
}
