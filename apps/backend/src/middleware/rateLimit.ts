import type { Request, Response } from 'express';

/**
 * Rate limiter factory.
 * Wraps express-rate-limit with sensible defaults per endpoint type.
 * Import rateLimit from 'express-rate-limit' once that package is installed.
 */

export interface RateLimitConfig {
  windowMs: number;   // Time window in milliseconds
  max:      number;   // Max requests per window per IP
  message:  string;   // Error message returned to client
}

const PRESETS: Record<string, RateLimitConfig> = {
  // Standard API calls — 300 req / 15 min
  default: {
    windowMs: 15 * 60 * 1000,
    max:      300,
    message:  'Too many requests. Please try again later.',
  },
  // Content generation — expensive AI calls — 20 req / 15 min
  generation: {
    windowMs: 15 * 60 * 1000,
    max:      20,
    message:  'Generation rate limit reached. Please wait before generating again.',
  },
  // Auth endpoints — 10 req / 15 min to prevent brute force
  auth: {
    windowMs: 15 * 60 * 1000,
    max:      10,
    message:  'Too many authentication attempts. Please try again later.',
  },
  // Admin endpoints — 100 req / 15 min
  admin: {
    windowMs: 15 * 60 * 1000,
    max:      100,
    message:  'Admin rate limit reached.',
  },
};

/**
 * Returns a rate limiter middleware for the given preset.
 * Usage: app.use('/api/content/generate', rateLimiter('generation'), handler)
 *
 * Requires: pnpm add express-rate-limit
 * Replace the stub below with:
 *   import rateLimit from 'express-rate-limit';
 *   return rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message } } });
 */
export const rateLimiter = (preset: keyof typeof PRESETS = 'default') => {
  const config = PRESETS[preset];
  // Stub middleware — replace with real express-rate-limit once installed
  return (_req: Request, _res: Response, next: () => void) => {
    void config;
    next();
  };
};

export { PRESETS as RATE_LIMIT_PRESETS };
