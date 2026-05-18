import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  SignupBodySchema,
  LoginBodySchema,
  RefreshBodySchema,
  PasswordResetRequestBodySchema,
  PasswordResetBodySchema,
  AuthErrorCode,
} from "@home-link/marketer-pro-contract";
import { hashPassword, verifyPassword } from "./auth/password.js";
import {
  signAccessToken,
  signRefreshToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
  ACCESS_TOKEN_TTL_S_EXPORT as ACCESS_TTL,
  REFRESH_TOKEN_TTL_S_EXPORT as REFRESH_TTL,
} from "./auth/jwt.js";
import { sendPasswordResetEmail } from "./auth/mailer.js";
import { authRateLimit } from "./auth/rate-limit.js";
import { requireAuth, securityHeaders } from "./auth/middleware.js";
import { getUserByEmail, getUserById, insertUser, updateUserPassword } from "../db/users.js";
import {
  insertRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from "../db/refresh-tokens.js";

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function getClientIpFromReq(req: IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}

function corsHeaders(res: ServerResponse): void {
  const origin = process.env.MARKETER_AUTH_HTTP_CORS?.trim();
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }
}

async function issueTokenPair(userId: string, tenantId: string, email: string, role: string) {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: userId, tid: tenantId, email, role: role as never }),
    signRefreshToken(userId, tenantId),
  ]);
  const jwtId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);
  await insertRefreshToken({ id: jwtId, userId, tenantId, token: refreshToken, expiresAt });
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL, tokenType: "Bearer" as const };
}

export async function handleAuthRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  securityHeaders(res);
  corsHeaders(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");
  const ip = getClientIpFromReq(req);

  // POST /auth/signup
  if (req.method === "POST" && pathname === "/auth/signup") {
    const rl = authRateLimit(ip);
    if (!rl.allowed) { json(res, 429, { error: AuthErrorCode.RATE_LIMITED }); return; }

    const body = await readBody(req);
    const parsed = SignupBodySchema.safeParse(body);
    if (!parsed.success) { json(res, 400, { error: "invalid_body", issues: parsed.error.issues }); return; }

    const { tenantId, email, password } = parsed.data;
    const existing = await getUserByEmail(tenantId, email);
    if (existing) { json(res, 409, { error: AuthErrorCode.EMAIL_TAKEN }); return; }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();
    const user = await insertUser({ id: userId, tenantId, email, passwordHash, role: "member" });
    if (!user) { json(res, 500, { error: "db_error" }); return; }

    const tokens = await issueTokenPair(userId, tenantId, email, "member");
    json(res, 201, { user: { id: user.id, email: user.email, role: user.role, tenantId }, tokens });
    return;
  }

  // POST /auth/login
  if (req.method === "POST" && pathname === "/auth/login") {
    const rl = authRateLimit(ip);
    if (!rl.allowed) { json(res, 429, { error: AuthErrorCode.RATE_LIMITED }); return; }

    const body = await readBody(req);
    const parsed = LoginBodySchema.safeParse(body);
    if (!parsed.success) { json(res, 400, { error: "invalid_body", issues: parsed.error.issues }); return; }

    const { tenantId, email, password } = parsed.data;
    const user = await getUserByEmail(tenantId, email);
    if (!user) {
      await new Promise(r => setTimeout(r, 200)); // constant-time response
      json(res, 401, { error: AuthErrorCode.INVALID_CREDENTIALS });
      return;
    }

    const valid = await verifyPassword(user.password_hash, password);
    if (!valid) { json(res, 401, { error: AuthErrorCode.INVALID_CREDENTIALS }); return; }

    const tokens = await issueTokenPair(user.id, tenantId, email, user.role);
    json(res, 200, { user: { id: user.id, email: user.email, role: user.role, tenantId }, tokens });
    return;
  }

  // POST /auth/refresh
  if (req.method === "POST" && pathname === "/auth/refresh") {
    const body = await readBody(req);
    const parsed = RefreshBodySchema.safeParse(body);
    if (!parsed.success) { json(res, 400, { error: "invalid_body" }); return; }

    const { refreshToken } = parsed.data;
    const claims = await verifyRefreshToken(refreshToken);
    if (!claims) { json(res, 401, { error: AuthErrorCode.TOKEN_INVALID }); return; }

    const storedToken = await getRefreshToken(refreshToken);
    if (!storedToken) { json(res, 401, { error: AuthErrorCode.TOKEN_EXPIRED }); return; }

    await revokeRefreshToken(refreshToken);

    const user = await getUserById(claims.userId);
    if (!user) { json(res, 401, { error: AuthErrorCode.USER_NOT_FOUND }); return; }

    const tokens = await issueTokenPair(user.id, user.tenant_id, user.email, user.role);
    json(res, 200, { tokens });
    return;
  }

  // POST /auth/logout
  if (req.method === "POST" && pathname === "/auth/logout") {
    const body = await readBody(req);
    const parsed = z.object({ refreshToken: z.string().optional(), allDevices: z.boolean().optional() }).safeParse(body);
    if (parsed.success && parsed.data.allDevices) {
      const auth = await requireAuth(req, res);
      if (!auth) return;
      await revokeAllUserTokens(auth.userId);
    } else if (parsed.success && parsed.data.refreshToken) {
      await revokeRefreshToken(parsed.data.refreshToken);
    }
    json(res, 200, { ok: true });
    return;
  }

  // GET /auth/me
  if (req.method === "GET" && pathname === "/auth/me") {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const user = await getUserById(auth.userId);
    if (!user) { json(res, 404, { error: AuthErrorCode.USER_NOT_FOUND }); return; }
    json(res, 200, { user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenant_id, emailVerified: user.email_verified } });
    return;
  }

  // POST /auth/password-reset-request
  if (req.method === "POST" && pathname === "/auth/password-reset-request") {
    const rl = authRateLimit(ip);
    if (!rl.allowed) { json(res, 429, { error: AuthErrorCode.RATE_LIMITED }); return; }

    const body = await readBody(req);
    const parsed = PasswordResetRequestBodySchema.safeParse(body);
    if (!parsed.success) { json(res, 400, { error: "invalid_body" }); return; }

    // Always return 200 to avoid user enumeration
    const user = await getUserByEmail(parsed.data.tenantId, parsed.data.email);
    if (user) {
      const resetToken = await signPasswordResetToken(user.id, user.tenant_id);
      const appOrigin = process.env.APP_ORIGIN?.trim() ?? "http://localhost:5173";
      const resetUrl = `${appOrigin}/reset-password?token=${encodeURIComponent(resetToken)}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }
    json(res, 200, { ok: true, message: "If that account exists, a reset link has been sent." });
    return;
  }

  // POST /auth/password-reset
  if (req.method === "POST" && pathname === "/auth/password-reset") {
    const body = await readBody(req);
    const parsed = PasswordResetBodySchema.safeParse(body);
    if (!parsed.success) { json(res, 400, { error: "invalid_body" }); return; }

    const claims = await verifyPasswordResetToken(parsed.data.token);
    if (!claims) { json(res, 401, { error: AuthErrorCode.TOKEN_INVALID }); return; }

    const passwordHash = await hashPassword(parsed.data.password);
    const updated = await updateUserPassword(claims.userId, passwordHash);
    if (!updated) { json(res, 404, { error: AuthErrorCode.USER_NOT_FOUND }); return; }

    await revokeAllUserTokens(claims.userId);
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { error: "not_found" });
}
