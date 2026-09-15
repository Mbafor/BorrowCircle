import { Router } from 'express';
import * as reportsController from '../controllers/reports.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validate, validateQuery } from '../middleware/validate.middleware';
import { createReportSchema, reportsQuerySchema } from '../validation/reports.validation';

const router = Router();

router.post('/api/reports', requireAuth, validate(createReportSchema), reportsController.create);
router.get('/api/reports', requireAuth, requireAdmin, validateQuery(reportsQuerySchema), reportsController.list);
router.patch('/api/reports/:id/review', requireAuth, requireAdmin, reportsController.review);
router.post('/api/reports/:id/remove-item', requireAuth, requireAdmin, reportsController.removeItem);
router.post('/api/reports/:id/suspend-user', requireAuth, requireAdmin, reportsController.suspendUser);

export default router;
