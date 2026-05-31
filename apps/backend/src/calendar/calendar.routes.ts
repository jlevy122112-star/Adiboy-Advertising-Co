import { Router } from 'express';
import { authGuard } from '../common/middleware/authGuard';
import { calendarController } from './calendar.controller';

const router = Router();

// GET /calendar
router.get('/', authGuard, calendarController.getEvents);

// GET /calendar/day
router.get('/day', authGuard, calendarController.getDayView);

// POST /calendar/drag
router.post('/drag', authGuard, calendarController.drag);

export default router;
