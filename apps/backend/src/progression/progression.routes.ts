import { Router } from 'express';
import { authGuard } from '../common/middleware/authGuard';
import { progressionController } from './progression.controller';

const router = Router();

// GET /progression
router.get('/', authGuard, progressionController.getProfile);

// POST /progression/event
router.post('/event', authGuard, progressionController.addEvent);

export default router;
