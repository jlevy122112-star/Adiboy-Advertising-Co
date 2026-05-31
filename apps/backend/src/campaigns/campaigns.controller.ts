import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/types';
import { campaignsService } from './campaigns.service';

export const campaignsController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, channel, objective } = req.query as Record<string, string>;
      const data = await campaignsService.getAll(req.user!.workspaceId, { status, channel, objective });
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await campaignsService.getById(req.params.id, req.user!.workspaceId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await campaignsService.create(req.user!.workspaceId, req.body);
      res.status(201).json({ data });
    } catch (err) { next(err); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await campaignsService.update(req.params.id, req.user!.workspaceId, req.body);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await campaignsService.delete(req.params.id, req.user!.workspaceId);
      res.status(200).json({ message: 'Campaign deleted' });
    } catch (err) { next(err); }
  },
};
