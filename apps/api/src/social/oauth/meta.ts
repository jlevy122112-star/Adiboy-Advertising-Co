// Facebook + Instagram OAuth (Meta Graph API)

const CLIENT_ID = process.env.META_APP_ID ?? "";
const CLIENT_SECRET = process.env.META_APP_SECRET ?? "";
const REDIRECT_URI = process.env.META_REDIRECT_URI ?? "http://localhost:8799/oauth/callback/meta";

const FB_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";

export type OAuthStartResult = { url: string; state: string };
export type OAuthTokens = { accessToken: string; expiresIn: number | null };

export function startMetaOAuth(state: string, network: "facebook" | "instagram"): OAuthStartResult {
  const scope = network === "instagram"
    ? "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement"
    : "pages_show_list,pages_read_engagement,pages_manage_posts,publish_video";

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state,
    response_type: "code",
  });

  return { url: `${FB_AUTH_URL}?${params}`, state };
}

export async function exchangeMetaCode(code: string): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  });

  const res = await fetch(`${FB_TOKEN_URL}?${params}`);
  if (!res.ok) throw new Error(`Meta token exchange failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in?: number };

  // Exchange short-lived for long-lived token (60 days)
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    fb_exchange_token: data.access_token,
  });

  const longRes = await fetch(`${FB_TOKEN_URL}?${longParams}`);
  if (!longRes.ok) return { accessToken: data.access_token, expiresIn: data.expires_in ?? null };
  const longData = await longRes.json() as { access_token: string; expires_in?: number };

  return { accessToken: longData.access_token, expiresIn: longData.expires_in ?? null };
}
