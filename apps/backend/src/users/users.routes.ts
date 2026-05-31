import { Router } from 'express';
import { authGuard } from '../common/middleware/authGuard';
import { usersController } from './users.controller';

const router = Router();

// GET /me
router.get('/me', authGuard, usersController.getMe);

// PATCH /me
router.patch('/me', authGuard, usersController.updateMe);

export default router;
