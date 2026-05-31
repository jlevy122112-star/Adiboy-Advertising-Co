import { Router } from 'express';
import { authGuard } from '../common/middleware/authGuard';
import { analyticsController } from './analytics.controller';

const router = Router();

// GET /analytics/overview
router.get('/overview', authGuard, analyticsController.getOverview);

// GET /analytics/campaigns
router.get('/campaigns', authGuard, analyticsController.getCampaigns);

// GET /analytics/content
router.get('/content', authGuard, analyticsController.getContent);

// GET /analytics/campaigns/:id
router.get('/campaigns/:id', authGuard, analyticsController.getCampaignById);

// GET /analytics/insights
router.get('/insights', authGuard, analyticsController.getInsights);

export default router;
