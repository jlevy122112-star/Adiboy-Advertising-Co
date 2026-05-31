import { Router } from 'express';
import { authGuard } from '../common/middleware/authGuard';
import { contentController } from './content.controller';

// Mounted at /campaigns/:campaignId/content and also /content
const router = Router({ mergeParams: true });

// GET /campaigns/:campaignId/content
router.get('/', authGuard, contentController.getByCampaign);

// POST /campaigns/:campaignId/content
router.post('/', authGuard, contentController.create);

export default router;

// Standalone /content/:id routes — registered separately in app.ts
export const contentItemRouter = Router();

// GET /content/:id
contentItemRouter.get('/:id', authGuard, contentController.getById);

// PATCH /content/:id
contentItemRouter.patch('/:id', authGuard, contentController.update);

// POST /content/:id/schedule
contentItemRouter.post('/:id/schedule', authGuard, contentController.schedule);

// POST /content/:id/publish
contentItemRouter.post('/:id/publish', authGuard, contentController.publish);
