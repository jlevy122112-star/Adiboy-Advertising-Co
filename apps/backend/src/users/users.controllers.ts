import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/types';
import { usersService } from './users.service';

export const usersController = {
  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await usersService.getMe(req.user!.userId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },

  async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await usersService.updateMe(req.user!.userId, req.body);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
};
