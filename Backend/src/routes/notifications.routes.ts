import { Router } from 'express';
import * as notificationsController from '../controllers/notifications.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validate.middleware';
import { notificationsQuerySchema } from '../validation/notifications.validation';

const router = Router();

router.get(
  '/api/notifications',
  requireAuth,
  validateQuery(notificationsQuerySchema),
  notificationsController.list,
);
router.get('/api/notifications/unread-count', requireAuth, notificationsController.unreadCount);
router.patch('/api/notifications/read-all', requireAuth, notificationsController.markAllRead);
router.patch('/api/notifications/:id/read', requireAuth, notificationsController.markRead);

export default router;
