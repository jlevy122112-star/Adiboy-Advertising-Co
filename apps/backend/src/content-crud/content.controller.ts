import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../common/types';
import { contentService } from './content.service';

export const contentController = {
  // GET /campaigns/:campaignId/content
  async getByCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await contentService.getByCampaign(req.params.campaignId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  // POST /campaigns/:campaignId/content
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await contentService.create(req.params.campaignId, req.body);
      res.status(201).json({ data });
    } catch (err) { next(err); }
  },

  // GET /content/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await contentService.getById(req.params.id);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  // PATCH /content/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await contentService.update(req.params.id, req.body);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  // POST /content/:id/schedule
  async schedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { scheduledAt } = req.body;
      const data = await contentService.schedule(req.params.id, scheduledAt);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  // POST /content/:id/publish
  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await contentService.publish(req.params.id);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },
};
