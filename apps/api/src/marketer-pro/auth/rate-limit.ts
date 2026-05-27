type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();

const CLEANUP_INTERVAL_MS = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of store) {
    if (w.resetAt < now) store.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let w = store.get(key);

  if (!w || w.resetAt < now) {
    w = { count: 0, resetAt: now + windowMs };
    store.set(key, w);
  }

  w.count++;
  const allowed = w.count <= maxRequests;
  return { allowed, remaining: Math.max(0, maxRequests - w.count), resetAt: w.resetAt };
}

export function authRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`auth:${ip}`, 10, 60_000);
}

export function globalRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`global:${ip}`, 300, 60_000);
}

/** 10 live-publish calls per tenant per 5 minutes — prevents accidental double-publish. */
export function publishRateLimit(tenantId: string): RateLimitResult {
  return checkRateLimit(`publish:${tenantId}`, 10, 300_000);
}

/** 60 AI generation calls per tenant per hour. */
export function generateRateLimit(tenantId: string): RateLimitResult {
  return checkRateLimit(`generate:${tenantId}`, 60, 3_600_000);
}

// ── Per-email login lockout ───────────────────────────────────────────────────

type LockRecord = { failures: number; lockedUntil?: number };
const lockStore = new Map<string, LockRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [k, r] of lockStore) {
    if (!r.lockedUntil || r.lockedUntil < now) lockStore.delete(k);
  }
}, 5 * 60_000).unref();

export type LockoutResult = { locked: boolean; retryAfterMs: number };

/** Check whether a tenantId:email key is currently locked out. */
export function checkLoginLockout(key: string): LockoutResult {
  const r = lockStore.get(key);
  if (!r?.lockedUntil) return { locked: false, retryAfterMs: 0 };
  const remaining = r.lockedUntil - Date.now();
  if (remaining <= 0) { lockStore.delete(key); return { locked: false, retryAfterMs: 0 }; }
  return { locked: true, retryAfterMs: remaining };
}

/**
 * Record a failed login attempt.
 * Lockout schedule: 5 failures → 15 min, 10 failures → 1 hour.
 * Returns current lockout state after recording.
 */
export function recordLoginFailure(key: string): LockoutResult {
  const now = Date.now();
  let r = lockStore.get(key) ?? { failures: 0 };
  // If previous lock expired, reset counter
  if (r.lockedUntil && r.lockedUntil < now) r = { failures: 0 };
  r.failures++;
  if (r.failures >= 10) r.lockedUntil = now + 60 * 60_000;       // 1 hour
  else if (r.failures >= 5) r.lockedUntil = now + 15 * 60_000;   // 15 min
  lockStore.set(key, r);
  return checkLoginLockout(key);
}

/** Clear failure record on successful login. */
export function clearLoginFailures(key: string): void {
  lockStore.delete(key);
}
