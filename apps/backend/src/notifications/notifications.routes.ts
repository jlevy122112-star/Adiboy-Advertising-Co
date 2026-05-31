import { Router } from 'express';
import { authGuard } from '../common/middleware/authGuard';
import { notificationsController } from './notifications.controller';

const router = Router();

// GET /notifications
router.get('/', authGuard, notificationsController.getAll);

// PATCH /notifications/:id/read
router.patch('/:id/read', authGuard, notificationsController.markRead);

// GET /notifications/preferences
router.get('/preferences', authGuard, notificationsController.getPreferences);

export default router;
