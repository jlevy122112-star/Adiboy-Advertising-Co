apps/api/src/middleware/usage.ts

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
Routes
apps/api/src/routes/usage.ts

ts
import { Router } from 'express';
import { getTenantUsage } from '../services/usage';
import type { PlanTier } from '@adiboy/contracts';

export const usageRouter = Router();

usageRouter.get('/', async (req, res) => {
  const tenantId = req.tenantId as string;
  const plan = req.plan as PlanTier;

  const usage = await getTenantUsage(tenantId, plan);
  res.json(usage);
});
