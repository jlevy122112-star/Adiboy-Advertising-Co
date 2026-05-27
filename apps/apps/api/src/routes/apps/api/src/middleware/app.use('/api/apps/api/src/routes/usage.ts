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
