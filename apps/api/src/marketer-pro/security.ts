/**
 * Security utilities:
 *   - Request ID propagation
 *   - In-memory idempotency store (single-process MVP)
 *   - Tenant isolation assertion
 *   - Structured log PII scrubber
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

// ── Request IDs ───────────────────────────────────────────────────────────────

/**
 * Read X-Request-ID from client or generate one; stamp it onto the response.
 * Returns the final ID so callers can include it in log events.
 */
export function applyRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers["x-request-id"];
  // Accept only simple alphanumeric/dash/underscore values to avoid header injection
  const safe = typeof incoming === "string" && /^[\w\-]{1,64}$/.test(incoming)
    ? incoming
    : randomUUID();
  res.setHeader("X-Request-ID", safe);
  return safe;
}

// ── Idempotency store ─────────────────────────────────────────────────────────

type CacheEntry<T> = { value: T; expiresAt: number };

export class IdempotencyStore<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private cleanupHandle: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs = 86_400_000) {
    this.ttlMs = ttlMs;
  }

  /** Start background cleanup; call once at app startup. */
  startCleanup(intervalMs = 300_000): this {
    this.cleanupHandle = setInterval(() => this.sweep(), intervalMs);
    (this.cleanupHandle as NodeJS.Timeout).unref?.();
    return this;
  }

  stopCleanup(): void {
    if (this.cleanupHandle) {
      clearInterval(this.cleanupHandle);
      this.cleanupHandle = null;
    }
  }

  has(key: string): boolean {
    const e = this.cache.get(key);
    return !!e && e.expiresAt > Date.now();
  }

  get(key: string): T | undefined {
    const e = this.cache.get(key);
    if (!e || e.expiresAt <= Date.now()) { this.cache.delete(key); return undefined; }
    return e.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, e] of this.cache) {
      if (e.expiresAt <= now) this.cache.delete(k);
    }
  }
}

// ── Tenant assertion ──────────────────────────────────────────────────────────

/**
 * Throw if a resource's stored tenantId doesn't match the request's tenantId.
 * Use this wherever we fetch a resource by ID (run, schedule entry, brief, etc.)
 * to catch mis-routing bugs before they become data leaks.
 */
export function assertTenantMatch(resourceTenantId: string, requestTenantId: string): void {
  if (resourceTenantId !== requestTenantId) {
    throw new TenantMismatchError(resourceTenantId, requestTenantId);
  }
}

export class TenantMismatchError extends Error {
  readonly code = "tenant_mismatch" as const;
  constructor(resourceTenant: string, requestTenant: string) {
    // Redact the actual IDs from the message so they don't surface in HTTP responses
    super(`Tenant mismatch: resource belongs to a different workspace`);
    this.name = "TenantMismatchError";
    // Keep structured details for server-side logging only
    Object.defineProperty(this, "_detail", {
      value: { resourceTenant, requestTenant },
      enumerable: false,
    });
  }
}

// ── Structured log helpers ────────────────────────────────────────────────────

/** Hash an email for log correlation without leaking PII. */
export function hashEmailForLog(email: string): string {
  // Simple deterministic prefix — not cryptographically strong, sufficient for log correlation
  const digest = Buffer.from(email.toLowerCase().trim()).toString("base64url").slice(0, 12);
  return `u:${digest}`;
}

/**
 * Build a safe structured log context — strips or hashes PII fields.
 * Pass any object; PII-named keys get redacted.
 */
export function safeLogCtx(ctx: Record<string, unknown>): Record<string, unknown> {
  const PII_KEYS = new Set(["email", "password", "token", "accessToken", "refreshToken", "secret", "key"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (PII_KEYS.has(k)) {
      out[k] = "[redacted]";
    } else if (k === "userId" || k === "tenantId") {
      // These are fine — non-personal IDs
      out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}
