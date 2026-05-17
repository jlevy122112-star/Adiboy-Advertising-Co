const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:8799/oauth/callback/linkedin";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

export type OAuthStartResult = { url: string; state: string };
export type OAuthTokens = { accessToken: string; refreshToken: string | null; expiresIn: number | null };

export function startLinkedInOAuth(state: string): OAuthStartResult {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
    scope: "openid profile email w_member_social",
  });

  return { url: `${AUTH_URL}?${params}`, state };
}

export async function exchangeLinkedInCode(code: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
  };
}

export async function refreshLinkedInToken(refreshToken: string): Promise<OAuthTokens> {
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

  if (!res.ok) throw new Error(`LinkedIn token refresh failed: ${res.status}`);
  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
  };
}
