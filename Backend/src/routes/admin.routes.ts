import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validate, validateQuery } from '../middleware/validate.middleware';
import { adminItemsQuerySchema, adminUsersQuerySchema, suspendUserBodySchema } from '../validation/admin.validation';

const router = Router();

router.get(
  '/api/admin/users',
  requireAuth,
  requireAdmin,
  validateQuery(adminUsersQuerySchema),
  adminController.listUsers,
);
router.get('/api/admin/users/:id', requireAuth, requireAdmin, adminController.getUser);
router.post(
  '/api/admin/users/:id/suspend',
  requireAuth,
  requireAdmin,
  validate(suspendUserBodySchema),
  adminController.suspendUser,
);
router.post('/api/admin/users/:id/reactivate', requireAuth, requireAdmin, adminController.reactivateUser);
router.get(
  '/api/admin/items',
  requireAuth,
  requireAdmin,
  validateQuery(adminItemsQuerySchema),
  adminController.listItems,
);
router.post('/api/admin/items/:id/remove', requireAuth, requireAdmin, adminController.removeItem);
router.get('/api/admin/stats', requireAuth, requireAdmin, adminController.getStats);

export default router;
