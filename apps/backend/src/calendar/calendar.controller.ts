import { Response, NextFunction } from 'express';
import { AuthRequest } from '../common/types';
import { calendarService } from './calendar.service';

export const calendarController = {
  // GET /calendar
  async getEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { start, end, channels, campaignId } = req.query as Record<string, string>;
      const data = await calendarService.getEvents(req.user!.workspaceId, {
        start, end, channels, campaignId,
      });
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  // GET /calendar/day
  async getDayView(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { date } = req.query as { date: string };
      const data = await calendarService.getDayView(req.user!.workspaceId, date);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },

  // POST /calendar/drag
  async drag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { contentId, newDateTime } = req.body;
      const data = await calendarService.drag(contentId, newDateTime);
      res.status(200).json({ data });
    } catch (err) { next(err); }
  },
};
