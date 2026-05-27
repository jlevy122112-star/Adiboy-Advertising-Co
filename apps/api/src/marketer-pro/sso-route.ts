/**
 * SSO routes — Google and Apple Sign-In for user authentication.
 * These are separate from the social-oauth-route (which handles publishing connections).
 *
 * Routes:
 *   GET  /auth/sso/google/start     — redirect to Google consent
 *   GET  /auth/sso/google/callback  — exchange code, issue session
 *   GET  /auth/sso/apple/start      — redirect to Apple consent
 *   POST /auth/sso/apple/callback   — form POST from Apple, issue session
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { securityHeaders } from "./auth/middleware.js";
import { signAccessToken, signRefreshToken, ACCESS_TOKEN_TTL_S_EXPORT as ACCESS_TTL } from "./auth/jwt.js";
import { insertRefreshToken } from "../db/refresh-tokens.js";
import { findOrCreateSsoUser } from "../db/oauth-accounts.js";
import { startGoogleSso, exchangeGoogleCode } from "../social/oauth/google-sso.js";
import { startAppleSso, exchangeAppleCode } from "../social/oauth/apple-sso.js";
import { randomUUID } from "node:crypto";

// State store — same PKCE/CSRF pattern as social-oauth-route
const SSO_STATE_TTL = 10 * 60 * 1000;
type PendingState = { state: string; provider: "google" | "apple"; codeVerifier?: string; expiresAt: number };
const pending = new Map<string, PendingState>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending) { if (v.expiresAt < now) pending.delete(k); }
}, 10 * 60 * 1000).unref();

const COOKIE_FLAGS = "HttpOnly; Path=/; SameSite=Lax";

function setSessionCookie(res: ServerResponse, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `mp_session=${token}; ${COOKIE_FLAGS}${secure}; Max-Age=${ACCESS_TTL}`);
}

function appOrigin(): string {
  return process.env.APP_ORIGIN?.trim() ?? "http://localhost:8780";
}

function redirect(res: ServerResponse, url: string): void {
  res.writeHead(302, { Location: url });
  res.end();
}

function errorRedirect(res: ServerResponse, msg: string): void {
  redirect(res, `${appOrigin()}/?sso_error=${encodeURIComponent(msg)}`);
}

async function readFormBody(req: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 32_768) reject(new Error("body too large")); });
    req.on("end", () => resolve(new URLSearchParams(body)));
    req.on("error", reject);
  });
}

async function issueSession(
  res: ServerResponse,
  userId: string,
  tenantId: string,
  email: string,
  role: string,
): Promise<void> {
  const jwtId = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: userId, tid: tenantId, email, role: role as "member" | "admin" }),
    signRefreshToken(userId, tenantId),
  ]);
  await insertRefreshToken({ id: jwtId, userId, tenantId, token: refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) });
  setSessionCookie(res, accessToken);
}

export async function handleSsoRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  securityHeaders(res);

  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "");

  // ── GET /auth/sso/google/start ───────────────────────────────────────────
  if (req.method === "GET" && path === "/auth/sso/google/start") {
    if (!process.env.GOOGLE_CLIENT_ID) {
      errorRedirect(res, "Google sign-in is not configured");
      return true;
    }
    const state = randomBytes(16).toString("hex");
    const { url: googleUrl, codeVerifier } = startGoogleSso(state);
    pending.set(state, { state, provider: "google", codeVerifier, expiresAt: Date.now() + SSO_STATE_TTL });
    redirect(res, googleUrl);
    return true;
  }

  // ── GET /auth/sso/google/callback ────────────────────────────────────────
  if (req.method === "GET" && path === "/auth/sso/google/callback") {
    const code  = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const pend  = pending.get(state);

    if (!code || !pend || pend.provider !== "google" || pend.expiresAt < Date.now()) {
      errorRedirect(res, "Invalid or expired Google sign-in. Please try again.");
      return true;
    }
    pending.delete(state);

    try {
      const profile = await exchangeGoogleCode(code, pend.codeVerifier!);
      const result = await findOrCreateSsoUser({
        provider: "google",
        providerId: profile.sub,
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.picture,
      });
      if (!result) throw new Error("User creation failed");

      await issueSession(res, result.user.id, result.tenantId, result.user.email, result.user.role);
      redirect(res, `${appOrigin()}/?sso=google${result.isNew ? "&sso_new=1" : ""}`);
    } catch (err) {
      console.error(JSON.stringify({ level: "error", event: "google_sso_error", message: String(err) }));
      errorRedirect(res, "Google sign-in failed. Please try again.");
    }
    return true;
  }

  // ── GET /auth/sso/apple/start ────────────────────────────────────────────
  if (req.method === "GET" && path === "/auth/sso/apple/start") {
    if (!process.env.APPLE_CLIENT_ID) {
      errorRedirect(res, "Apple sign-in is not configured");
      return true;
    }
    const state = randomBytes(16).toString("hex");
    const { url: appleUrl } = startAppleSso(state);
    pending.set(state, { state, provider: "apple", expiresAt: Date.now() + SSO_STATE_TTL });
    redirect(res, appleUrl);
    return true;
  }

  // ── POST /auth/sso/apple/callback (Apple sends form POST) ────────────────
  if (req.method === "POST" && path === "/auth/sso/apple/callback") {
    let params: URLSearchParams;
    try { params = await readFormBody(req); } catch {
      errorRedirect(res, "Invalid Apple callback");
      return true;
    }

    const code  = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    const userJson = params.get("user") ?? undefined; // only on first sign-in
    const pend  = pending.get(state);

    if (!code || !pend || pend.provider !== "apple" || pend.expiresAt < Date.now()) {
      errorRedirect(res, "Invalid or expired Apple sign-in. Please try again.");
      return true;
    }
    pending.delete(state);

    try {
      const profile = await exchangeAppleCode(code, userJson);
      const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || undefined;
      const result = await findOrCreateSsoUser({
        provider: "apple",
        providerId: profile.sub,
        email: profile.email,
        displayName,
      });
      if (!result) throw new Error("User creation failed");

      await issueSession(res, result.user.id, result.tenantId, result.user.email, result.user.role);
      redirect(res, `${appOrigin()}/?sso=apple${result.isNew ? "&sso_new=1" : ""}`);
    } catch (err) {
      console.error(JSON.stringify({ level: "error", event: "apple_sso_error", message: String(err) }));
      errorRedirect(res, "Apple sign-in failed. Please try again.");
    }
    return true;
  }

  return false; // not an SSO route
}
