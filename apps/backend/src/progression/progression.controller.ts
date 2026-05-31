import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/types';
import { progressionService } from './progression.service';

export const progressionController = {
  // GET /progression
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await progressionService.getProfile(req.user!.userId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  // POST /progression/event
  async addEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { eventType } = req.body;
      const data = await progressionService.addEvent(req.user!.userId, eventType);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },
};
