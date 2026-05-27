/**
 * Google Sign-In (OpenID Connect / OAuth 2.0)
 *
 * Required env:
 *   GOOGLE_CLIENT_ID      — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET  — from Google Cloud Console
 *
 * Redirect URI to register in Google Cloud Console:
 *   {APP_ORIGIN}/auth/sso/google/callback
 */
import { createHash, randomBytes } from "node:crypto";

const CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const CLIENT_SECRET = () => process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";

function redirectUri(): string {
  const origin = process.env.APP_ORIGIN?.trim() ?? "http://localhost:8780";
  return `${origin}/auth/sso/google/callback`;
}

export type GoogleSsoStart = { url: string; state: string; codeVerifier: string };

/** Generate PKCE challenge */
function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function startGoogleSso(state: string): GoogleSsoStart {
  const { verifier, challenge } = pkce();
  const params = new URLSearchParams({
    client_id: CLIENT_ID(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state, codeVerifier: verifier };
}

export type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
): Promise<GoogleUserInfo> {
  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed (${tokenRes.status}): ${err}`);
  }

  const tokens = await tokenRes.json() as { access_token: string; id_token?: string };

  // Fetch user info from userinfo endpoint (safer than decoding id_token ourselves)
  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!infoRes.ok) throw new Error(`Google userinfo failed: ${infoRes.status}`);
  const info = await infoRes.json() as GoogleUserInfo;

  if (!info.email) throw new Error("Google did not return an email address");
  if (!info.email_verified) throw new Error("Google email is not verified");

  return info;
}
