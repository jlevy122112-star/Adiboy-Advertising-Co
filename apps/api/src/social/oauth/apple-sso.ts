/**
 * Sign in with Apple (OAuth 2.0 / OpenID Connect)
 *
 * Required env:
 *   APPLE_CLIENT_ID     — Services ID (e.g. com.marketerpro.web)
 *   APPLE_TEAM_ID       — 10-char Apple Team ID
 *   APPLE_KEY_ID        — Key ID from Apple Developer Portal
 *   APPLE_PRIVATE_KEY   — Full p8 key content (with -----BEGIN PRIVATE KEY----- header)
 *
 * Redirect URI to register in Apple Developer Portal:
 *   {APP_ORIGIN}/auth/sso/apple/callback
 *
 * Apple sends the callback as a form POST (not GET), so the route handler
 * must parse application/x-www-form-urlencoded body.
 */
import { randomBytes } from "node:crypto";
import { SignJWT, decodeJwt } from "jose";

function env(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function redirectUri(): string {
  const origin = process.env.APP_ORIGIN?.trim() ?? "http://localhost:8780";
  return `${origin}/auth/sso/apple/callback`;
}

export type AppleSsoStart = { url: string; state: string };

export function startAppleSso(state: string): AppleSsoStart {
  const params = new URLSearchParams({
    client_id: env("APPLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "name email",
    response_mode: "form_post",
    state,
  });
  return { url: `https://appleid.apple.com/auth/authorize?${params}`, state };
}

/** Build the Apple client_secret JWT (valid 6 months max, we use 5 min). */
async function buildClientSecret(): Promise<string> {
  const privateKeyPem = env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const keyData = new TextEncoder().encode(privateKeyPem);

  // Import the EC P-256 private key
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env("APPLE_KEY_ID") })
    .setIssuer(env("APPLE_TEAM_ID"))
    .setSubject(env("APPLE_CLIENT_ID"))
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

  void keyData; // suppress unused warning (we use subtle directly)
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export type AppleUserInfo = {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

/**
 * Exchange the Apple auth code for an id_token and decode user info.
 * `userJson` is the one-time JSON string Apple sends on first sign-in only.
 */
export async function exchangeAppleCode(
  code: string,
  userJson?: string,
): Promise<AppleUserInfo> {
  if (!env("APPLE_CLIENT_ID") || !env("APPLE_TEAM_ID") || !env("APPLE_KEY_ID") || !env("APPLE_PRIVATE_KEY")) {
    throw new Error("Apple SSO not configured — set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY");
  }

  const clientSecret = await buildClientSecret();

  const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("APPLE_CLIENT_ID"),
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Apple token exchange failed (${tokenRes.status}): ${err}`);
  }

  const tokens = await tokenRes.json() as { id_token: string };
  if (!tokens.id_token) throw new Error("Apple did not return id_token");

  // Decode (not verify — Apple's public keys would require JWKS fetch; sub+email are safe to read)
  const claims = decodeJwt(tokens.id_token) as { sub?: string; email?: string };
  if (!claims.sub || !claims.email) throw new Error("Apple id_token missing sub or email");

  // Apple only sends name on the very first sign-in
  let firstName: string | undefined;
  let lastName: string | undefined;
  if (userJson) {
    try {
      const parsed = JSON.parse(userJson) as { name?: { firstName?: string; lastName?: string } };
      firstName = parsed.name?.firstName;
      lastName = parsed.name?.lastName;
    } catch { /* ignore */ }
  }

  return { sub: claims.sub, email: claims.email, firstName, lastName };
}

export { randomBytes };
