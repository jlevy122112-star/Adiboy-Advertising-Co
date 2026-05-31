import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/types';
import { notificationsService } from './notifications.service';

export const notificationsController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await notificationsService.getAll(req.user!.userId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await notificationsService.markRead(req.params.id, req.user!.userId);
      res.status(200).json({ message: 'Marked as read' });
    } catch (err) { next(err); }
  },

  async getPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await notificationsService.getPreferences(req.user!.userId);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },
};
