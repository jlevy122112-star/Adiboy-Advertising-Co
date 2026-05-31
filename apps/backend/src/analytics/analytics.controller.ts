import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/types';
import { analyticsService } from './analytics.service';

export const analyticsController = {
  async getOverview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getOverview(req.user!.workspaceId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async getCampaigns(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getCampaigns(req.user!.workspaceId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async getContent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getContent(req.user!.workspaceId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async getCampaignById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getCampaignById(req.params.id, req.user!.workspaceId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async getInsights(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getInsights(req.user!.workspaceId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },
};
