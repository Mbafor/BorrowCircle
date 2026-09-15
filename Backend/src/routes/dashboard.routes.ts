import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validate.middleware';
import { borrowingQuerySchema, lendingQuerySchema } from '../validation/dashboard.validation';

const router = Router();

router.get('/api/dashboard/lending', requireAuth, validateQuery(lendingQuerySchema), dashboardController.getLending);
router.get(
  '/api/dashboard/borrowing',
  requireAuth,
  validateQuery(borrowingQuerySchema),
  dashboardController.getBorrowing,
);
router.get('/api/dashboard/summary', requireAuth, dashboardController.getSummary);

export default router;
