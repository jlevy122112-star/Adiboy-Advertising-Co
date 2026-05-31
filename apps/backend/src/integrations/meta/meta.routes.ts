import { Router, Request, Response, NextFunction } from 'express';
import { authGuard } from '../../common/middleware/authGuard';
import { AuthRequest } from '../../common/types';
import { metaService } from './meta.service';

const router = Router();

// POST /integrations/meta/connect — returns OAuth URL for redirect
router.post('/connect', authGuard, (req: AuthRequest, res: Response) => {
  const url = metaService.getOAuthUrl(req.user!.workspaceId);
  res.status(200).json({ data: { url } });
});

// GET /integrations/meta/status
router.get('/status', authGuard, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await metaService.getStatus(req.user!.workspaceId);
    res.status(200).json({ data });
  } catch (err) { next(err); }
});

// POST /integrations/meta/webhook — for Meta platform updates
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await metaService.handleWebhook(req.body);
    res.status(200).json({ data });
  } catch (err) { next(err); }
});

export default router;
