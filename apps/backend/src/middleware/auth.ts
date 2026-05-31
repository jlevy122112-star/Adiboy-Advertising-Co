import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the JWT in the Authorization header or session cookie.
 * Attaches the decoded user to req.user.
 * Returns 401 if the token is missing or invalid.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token =
      extractBearerToken(req.headers.authorization) ??
      extractCookieToken(req.headers.cookie);

    if (!token) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const user = await verifyToken(token);

    if (!user) {
      res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired' },
      });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({
      error: { code: 'AUTH_ERROR', message: 'Authentication failed' },
    });
  }
};

/**
 * Verifies that req.user has the required plan tier.
 * Must be used after requireAuth.
 */
export const requirePlan = (
  ...plans: AuthenticatedUser['plan'][]
) => (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user || !plans.includes(req.user.plan)) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: `Requires plan: ${plans.join(' or ')}` },
    });
    return;
  }
  next();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function extractCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Stub: replace with real Supabase JWT verification.
 * e.g. supabase.auth.getUser(token)
 */
async function verifyToken(token: string): Promise<AuthenticatedUser | null> {
  // TODO: replace with:
  // const { data, error } = await supabase.auth.getUser(token);
  // if (error || !data.user) return null;
  // return { id: data.user.id, email: data.user.email!, plan: data.user.user_metadata.plan ?? 'free' };
  void token;
  return null;
}
