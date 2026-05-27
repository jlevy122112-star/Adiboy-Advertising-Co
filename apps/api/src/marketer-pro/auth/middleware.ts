import type { IncomingMessage, ServerResponse } from "node:http";
import { verifyAccessToken } from "./jwt.js";
import type { JwtPayload } from "@home-link/marketer-pro-contract";

export type AuthContext = {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
};

export function securityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // CSP: allow same-origin scripts/styles + external CDNs the frontend needs.
  // 'unsafe-inline' required for the inline JS/CSS in the single-file mobile app.
  // Tighten to nonces when the frontend moves to separate JS bundles.
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",          // S3, DALL-E, CDN images
      "connect-src 'self'",                          // all API calls are same-origin
      "frame-ancestors 'none'",                      // no embedding in iframes
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com", // Stripe checkout redirect
    ].join("; "),
  );
}

export function extractBearerToken(req: IncomingMessage): string | null {
  // 1. httpOnly cookie — preferred path for browser sessions (XSS-safe)
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)mp_session=([^;]+)/);
    if (match?.[1]) return match[1];
  }

  // 2. Authorization: Bearer header — for API clients / mobile SDKs
  const auth = req.headers.authorization?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }

  // 3. ?t= query param for browser redirect flows (OAuth connect popup)
  try {
    const u = new URL(req.url ?? "/", "http://x");
    const t = u.searchParams.get("t");
    if (t) return t;
  } catch { /* ignore */ }

  return null;
}

export async function requireAuth(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<AuthContext | null> {
  const token = extractBearerToken(req);
  if (!token) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized", code: "missing_token" }));
    return null;
  }

  const payload: JwtPayload | null = await verifyAccessToken(token);
  if (!payload) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized", code: "invalid_token" }));
    return null;
  }

  return { userId: payload.sub, tenantId: payload.tid, email: payload.email, role: payload.role };
}

export function requireStaticToken(
  req: IncomingMessage,
  res: ServerResponse,
  envVar: string,
): boolean {
  const expected = process.env[envVar]?.trim();
  if (!expected) return true;
  const token = extractBearerToken(req);
  if (!token || token !== expected) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return false;
  }
  return true;
}

export function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? "unknown";
}
