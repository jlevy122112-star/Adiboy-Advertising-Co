import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { requireAuth, securityHeaders } from "./auth/middleware.js";
import { upsertSocialCredential, listSocialCredentials, deleteSocialCredential } from "../db/social-credentials.js";
import { startXOAuth, exchangeXCode } from "../social/oauth/x.js";
import { startMetaOAuth, exchangeMetaCode } from "../social/oauth/meta.js";
import { startLinkedInOAuth, exchangeLinkedInCode } from "../social/oauth/linkedin.js";
import { startYouTubeOAuth, exchangeYouTubeCode } from "../social/oauth/youtube.js";
import { startTikTokOAuth, exchangeTikTokCode } from "../social/oauth/tiktok.js";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches typical OAuth UX window

type PendingOAuth = {
  codeVerifier?: string;
  state: string;
  userId: string;
  tenantId: string;
  network: string;
  expiresAt: number;
};
const pending = new Map<string, PendingOAuth>();

// Purge expired state entries every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending) {
    if (v.expiresAt < now) pending.delete(k);
  }
}, 10 * 60 * 1000).unref();

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const SUPPORTED = ["x", "meta", "linkedin", "youtube", "tiktok"] as const;
type Network = (typeof SUPPORTED)[number];

function isSupportedNetwork(n: string): n is Network {
  return (SUPPORTED as readonly string[]).includes(n);
}

export async function handleSocialOAuthRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  securityHeaders(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");

  // GET /oauth/connect/:network — start OAuth flow
  const connectMatch = pathname.match(/^\/oauth\/connect\/([^/]+)$/);
  if (req.method === "GET" && connectMatch) {
    const network = connectMatch[1]!;
    if (!isSupportedNetwork(network)) { json(res, 400, { error: "unsupported_network" }); return; }

    const auth = await requireAuth(req, res);
    if (!auth) return;

    const state = randomBytes(16).toString("hex");
    let redirectUrl: string;
    let codeVerifier: string | undefined;

    if (network === "x") {
      const r = startXOAuth(state);
      redirectUrl = r.url;
      codeVerifier = r.codeVerifier;
    } else if (network === "meta") {
      const r = startMetaOAuth(state, "facebook");
      redirectUrl = r.url;
    } else if (network === "linkedin") {
      const r = startLinkedInOAuth(state);
      redirectUrl = r.url;
    } else if (network === "tiktok") {
      const r = startTikTokOAuth(state);
      redirectUrl = r.url;
      codeVerifier = r.codeVerifier;
    } else {
      const r = startYouTubeOAuth(state);
      redirectUrl = r.url;
      codeVerifier = r.codeVerifier;
    }

    pending.set(state, { codeVerifier, state, userId: auth.userId, tenantId: auth.tenantId, network, expiresAt: Date.now() + OAUTH_STATE_TTL_MS });
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
  }

  // GET /oauth/callback/:network — OAuth provider redirect back
  const callbackMatch = pathname.match(/^\/oauth\/callback\/([^/]+)$/);
  if (req.method === "GET" && callbackMatch) {
    const network = callbackMatch[1]!;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) { json(res, 400, { error: "oauth_denied", detail: error }); return; }
    if (!code || !state) { json(res, 400, { error: "missing_code_or_state" }); return; }

    const pend = pending.get(state);
    if (!pend || pend.network !== network || pend.expiresAt < Date.now()) {
      pending.delete(state); // consume even on failure to prevent retry abuse
      json(res, 400, { error: "invalid_state" });
      return;
    }
    pending.delete(state);

    try {
      let accessToken: string;
      let refreshToken: string | null = null;
      let expiresIn: number | null = null;
      let metadata: Record<string, unknown> | undefined;

      if (network === "x") {
        const t = await exchangeXCode(code, pend.codeVerifier!);
        accessToken = t.accessToken; refreshToken = t.refreshToken; expiresIn = t.expiresIn;
      } else if (network === "meta") {
        const t = await exchangeMetaCode(code);
        accessToken = t.accessToken; expiresIn = t.expiresIn;
      } else if (network === "linkedin") {
        const t = await exchangeLinkedInCode(code);
        accessToken = t.accessToken; refreshToken = t.refreshToken; expiresIn = t.expiresIn;
      } else if (network === "tiktok") {
        const t = await exchangeTikTokCode(code, pend.codeVerifier!);
        accessToken = t.accessToken; refreshToken = t.refreshToken; expiresIn = t.expiresIn;
        // Store openId in metadata for later publish/analytics use
        metadata = { openId: t.openId };
      } else {
        const t = await exchangeYouTubeCode(code, pend.codeVerifier!);
        accessToken = t.accessToken; refreshToken = t.refreshToken; expiresIn = t.expiresIn;
      }

      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
      await upsertSocialCredential({ tenantId: pend.tenantId, network, accessToken, refreshToken, expiresAt, metadata });

      // Redirect to frontend success page
      const frontendBase = process.env.MARKETER_FRONTEND_URL?.trim() ?? "http://localhost:5173";
      res.writeHead(302, { Location: `${frontendBase}/connections?connected=${network}` });
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ level: "error", event: "oauth_callback_error", network, message: msg }));
      json(res, 500, { error: "token_exchange_failed" });
    }
    return;
  }

  // GET /oauth/connections — list connected accounts
  if (req.method === "GET" && pathname === "/oauth/connections") {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const rows = await listSocialCredentials(auth.tenantId);
    const connections = rows.map((r: import("../db/social-credentials.js").SocialCredentialRow) => ({
      network: r.network,
      expiresAt: r.expires_at,
      needsReconnect: r.expires_at ? new Date(r.expires_at).getTime() - Date.now() < 5 * 60 * 1000 : false,
    }));
    json(res, 200, { connections });
    return;
  }

  // DELETE /oauth/connections/:network — disconnect
  const deleteMatch = pathname.match(/^\/oauth\/connections\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const network = deleteMatch[1]!;
    const auth = await requireAuth(req, res);
    if (!auth) return;

    await deleteSocialCredential(auth.tenantId, network);
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "not_found" });
}
