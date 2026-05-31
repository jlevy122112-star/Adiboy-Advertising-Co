import { Router } from 'express';
import { authGuard } from '../common/middleware/authGuard';
import { campaignsController } from './campaigns.controller';
import contentRoutes from '../content/content.routes';

const router = Router();

// GET /campaigns
router.get('/', authGuard, campaignsController.getAll);

// GET /campaigns/:id
router.get('/:id', authGuard, campaignsController.getById);

// POST /campaigns
router.post('/', authGuard, campaignsController.create);

// PATCH /campaigns/:id
router.patch('/:id', authGuard, campaignsController.update);

// DELETE /campaigns/:id
router.delete('/:id', authGuard, campaignsController.delete);

// Nested: GET /campaigns/:id/content, POST /campaigns/:id/content
router.use('/:campaignId/content', contentRoutes);

export default router;
