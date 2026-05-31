
import type { Express, RequestHandler } from 'express';

const creatorProfileHandler: RequestHandler = async (req, res) => {
  const userId = (req as any).user?.id;

  // Join users, xp, office_state, achievements, scene_progress tables for userId
  // Compute rank label from prestigeRank
  res.json({
    userId,
    name:             '',
    rank:             'Apprentice Marketer',
    level:            1,
    prestigeRank:     0,
    currentStreak:    0,
    longestStreak:    0,
    generationsCount: 0,
    achievements:     [],
    officeLevel:      1,
    unlockedScenes:   ['vault'],
  });
};

export function registerCreatorRoutes(app: Express): void {
  // GET /creator/profile
  app.get('/creator/profile', creatorProfileHandler);
}
