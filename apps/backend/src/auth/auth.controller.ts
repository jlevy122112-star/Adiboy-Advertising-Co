import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export const authController = {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const tokens = await authService.signup(req.body);
      res.status(201).json({ data: tokens });
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const tokens = await authService.login(req.body);
      res.status(200).json({ data: tokens });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refresh(refreshToken);
      res.status(200).json({ data: tokens });
    } catch (err) {
      next(err);
    }
  },

  async logout(_req: Request, res: Response) {
    // Client discards tokens; stateless JWT — nothing to invalidate server-side
    res.status(200).json({ message: 'Logged out' });
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body);
      res.status(200).json({ message: 'If that email exists, a reset link has been sent' });
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resetPassword(req.body);
      res.status(200).json({ message: 'Password reset successfully' });
    } catch (err) {
      next(err);
    }
  },
};
