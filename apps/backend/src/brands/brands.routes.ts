import { Router } from 'express';
import { authGuard } from '../common/middleware/authGuard';
import { brandsController } from './brands.controller';

const router = Router();

// GET /brands
router.get('/', authGuard, brandsController.getAll);

// POST /brands
router.post('/', authGuard, brandsController.create);

// PATCH /brands/:id
router.patch('/:id', authGuard, brandsController.update);

export default router;
