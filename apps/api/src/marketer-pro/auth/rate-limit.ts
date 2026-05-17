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
