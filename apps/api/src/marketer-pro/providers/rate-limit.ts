import type { PublishJobResult } from "@home-link/marketer-pro-queue";

/**
 * Parse a Retry-After header value into milliseconds.
 * Handles both the delay-seconds form ("120") and the HTTP-date form ("Wed, 21 Oct 2025 07:28:00 GMT").
 * Returns undefined when the header is absent or unparseable.
 */
export function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get("Retry-After")?.trim()
  if (!raw) return undefined

  const seconds = Number(raw)
  if (!isNaN(seconds) && seconds > 0) return Math.ceil(seconds) * 1000

  const date = new Date(raw)
  if (!isNaN(date.getTime())) {
    const ms = date.getTime() - Date.now()
    return ms > 0 ? ms : 1000
  }

  return undefined
}

export function isRateLimited(res: Response): boolean {
  return res.status === 429
}

export function rateLimitResult(
  res: Response,
  prefix: string,
): PublishJobResult {
  const retryAfterMs = parseRetryAfter(res.headers)
  return {
    ok: false,
    detail: `${prefix}_rate_limited`,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  }
}
