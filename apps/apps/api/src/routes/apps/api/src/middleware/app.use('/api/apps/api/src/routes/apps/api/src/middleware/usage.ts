ts
import type { Request, Response, NextFunction } from 'express';
import { checkUsageLimit } from '../services/usage';
import type { PlanTier } from '@adiboy/contracts';

export function requireUsageWithinLimit(
  metric: 'aiGenerations' | 'postsPublished' | 'storageBytes'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.tenantId as string; // adjust
    const plan = req.plan as PlanTier;       // adjust

    const { allowed, usage } = await checkUsageLimit(tenantId, plan, metric);

    if (!allowed) {
      return res.status(402).json({
        error: 'usage_limit_exceeded',
        metric,
        usage
      });
    }

    (req as any).usageSnapshot = usage;
    next();
  };
}
