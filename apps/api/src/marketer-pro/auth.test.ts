import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";

// Mock DB + JWT + password modules
vi.mock("../db/users.js", () => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  insertUser: vi.fn(),
  updateUserPassword: vi.fn(),
}));
vi.mock("../db/refresh-tokens.js", () => ({
  insertRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllUserTokens: vi.fn(),
}));
vi.mock("./auth/password.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("$argon2id$hash"),
  verifyPassword: vi.fn(),
}));
vi.mock("./auth/jwt.js", () => ({
  signAccessToken: vi.fn().mockResolvedValue("access_tok"),
  signRefreshToken: vi.fn().mockResolvedValue("refresh_tok"),
  verifyRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
  ACCESS_TOKEN_TTL_S_EXPORT: 900,
  REFRESH_TOKEN_TTL_S_EXPORT: 604800,
}));

import { handleAuthRequest } from "./auth-route.js";
import { getUserByEmail, insertUser } from "../db/users.js";
import { insertRefreshToken, getRefreshToken } from "../db/refresh-tokens.js";
import { verifyPassword } from "./auth/password.js";
import { verifyRefreshToken } from "./auth/jwt.js";

process.env.MARKETER_JWT_SECRET = "test-secret-at-least-32-chars-long!";

function makeReq(method: string, path: string, body?: unknown): IncomingMessage {
  const req = {
    method,
    url: path,
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    on: vi.fn((event: string, cb: (d?: unknown) => void) => {
      if (event === "data" && body) cb(Buffer.from(JSON.stringify(body)));
      if (event === "end") cb();
    }),
  } as unknown as IncomingMessage;
  return req;
}

function makeRes(): { res: ServerResponse; status: () => number; body: () => unknown } {
  let statusCode = 200;
  let responseBody: unknown = null;
  const headers: Record<string, string> = {};
  const res = {
    writeHead: vi.fn((s: number) => { statusCode = s; }),
    setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
    end: vi.fn((b?: string) => { if (b) try { responseBody = JSON.parse(b); } catch { responseBody = b; } }),
    headersSent: false,
  } as unknown as ServerResponse;
  return { res, status: () => statusCode, body: () => responseBody };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("POST /auth/signup", () => {
  it("returns 409 when email already taken", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce({ id: "u1" } as never);
    const req = makeReq("POST", "/auth/signup", { tenantId: "t1", email: "a@b.com", password: "pass1234" });
    const { res, status } = makeRes();
    await handleAuthRequest(req, res);
    expect(status()).toBe(409);
  });

  it("returns 201 and tokens on success", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    vi.mocked(insertUser).mockResolvedValueOnce({ id: "u1", email: "a@b.com", role: "member" } as never);
    vi.mocked(insertRefreshToken).mockResolvedValueOnce(null);
    const req = makeReq("POST", "/auth/signup", { tenantId: "t1", email: "a@b.com", password: "pass1234" });
    const { res, status, body } = makeRes();
    await handleAuthRequest(req, res);
    expect(status()).toBe(201);
    expect((body() as { tokens: { accessToken: string } }).tokens.accessToken).toBe("access_tok");
  });
});

describe("POST /auth/login", () => {
  it("returns 401 when user not found", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce(null);
    const req = makeReq("POST", "/auth/login", { tenantId: "t1", email: "a@b.com", password: "bad" });
    const { res, status } = makeRes();
    await handleAuthRequest(req, res);
    expect(status()).toBe(401);
  });

  it("returns 401 when password wrong", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce({ id: "u1", password_hash: "hash", role: "member", email: "a@b.com" } as never);
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);
    const req = makeReq("POST", "/auth/login", { tenantId: "t1", email: "a@b.com", password: "bad" });
    const { res, status } = makeRes();
    await handleAuthRequest(req, res);
    expect(status()).toBe(401);
  });

  it("returns 200 and tokens on success", async () => {
    vi.mocked(getUserByEmail).mockResolvedValueOnce({ id: "u1", password_hash: "hash", role: "member", email: "a@b.com", tenant_id: "t1" } as never);
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);
    vi.mocked(insertRefreshToken).mockResolvedValueOnce(null);
    const req = makeReq("POST", "/auth/login", { tenantId: "t1", email: "a@b.com", password: "pass1234" });
    const { res, status } = makeRes();
    await handleAuthRequest(req, res);
    expect(status()).toBe(200);
  });
});

describe("POST /auth/refresh", () => {
  it("returns 401 when refresh token invalid", async () => {
    vi.mocked(verifyRefreshToken).mockResolvedValueOnce(null);
    const req = makeReq("POST", "/auth/refresh", { refreshToken: "bad" });
    const { res, status } = makeRes();
    await handleAuthRequest(req, res);
    expect(status()).toBe(401);
  });

  it("returns 401 when token not in DB", async () => {
    vi.mocked(verifyRefreshToken).mockResolvedValueOnce({ userId: "u1", tenantId: "t1" });
    vi.mocked(getRefreshToken).mockResolvedValueOnce(null);
    const req = makeReq("POST", "/auth/refresh", { refreshToken: "tok" });
    const { res, status } = makeRes();
    await handleAuthRequest(req, res);
    expect(status()).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns 401 with no auth header", async () => {
    const req = makeReq("GET", "/auth/me");
    const { res, status } = makeRes();
    await handleAuthRequest(req, res);
    expect(status()).toBe(401);
  });
});
