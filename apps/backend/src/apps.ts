import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requestLogger } from './common/middleware/requestLogger';
import { errorHandler } from './common/middleware/errorHandler';

// Route imports
import authRoutes from './auth/auth.routes';
import usersRoutes from './users/users.routes';
import brandsRoutes from './brands/brands.routes';
import campaignsRoutes from './campaigns/campaigns.routes';
import { contentItemRouter } from './content/content.routes';
import calendarRoutes from './calendar/calendar.routes';
import analyticsRoutes from './analytics/analytics.routes';
import progressionRoutes from './progression/progression.routes';
import notificationsRoutes from './notifications/notifications.routes';
import metaRoutes from './integrations/meta/meta.routes';

const app = express();

// ── Middleware ──────────────────────────────
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(requestLogger);

// ── Routes — exact API surface from document ──
app.use('/auth', authRoutes);
app.use('/', usersRoutes);          // GET /me, PATCH /me
app.use('/brands', brandsRoutes);
app.use('/campaigns', campaignsRoutes);
app.use('/content', contentItemRouter);
app.use('/calendar', calendarRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/progression', progressionRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/integrations/meta', metaRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler — must be last ──
app.use(errorHandler);

export default app;
