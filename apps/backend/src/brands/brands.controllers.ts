import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/types';
import { brandsService } from './brands.service';

export const brandsController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await brandsService.getByWorkspace(req.user!.workspaceId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await brandsService.create(req.user!.workspaceId, req.body);
      res.status(201).json({ data });
    } catch (err) { next(err); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await brandsService.update(req.params.id, req.user!.workspaceId, req.body);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },
};
