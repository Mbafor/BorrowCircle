import { Router } from 'express';
import * as requestsController from '../controllers/requests.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate, validateQuery } from '../middleware/validate.middleware';
import {
  confirmPickupSchema,
  confirmReturnSchema,
  createRequestSchema,
  declineRequestSchema,
  incomingRequestsQuerySchema,
} from '../validation/requests.validation';

const router = Router();

router.post('/api/requests', requireAuth, validate(createRequestSchema), requestsController.create);
router.get('/api/requests/mine', requireAuth, requestsController.getMine);
router.get(
  '/api/requests/incoming',
  requireAuth,
  validateQuery(incomingRequestsQuerySchema),
  requestsController.getIncoming,
);
router.get('/api/requests/:id', requireAuth, requestsController.getById);
router.patch('/api/requests/:id/cancel', requireAuth, requestsController.cancel);
router.patch('/api/requests/:id/accept', requireAuth, requestsController.accept);
router.patch(
  '/api/requests/:id/decline',
  requireAuth,
  validate(declineRequestSchema),
  requestsController.decline,
);
router.patch(
  '/api/requests/:id/confirm-pickup',
  requireAuth,
  validate(confirmPickupSchema),
  requestsController.confirmPickup,
);
router.patch(
  '/api/requests/:id/confirm-return',
  requireAuth,
  validate(confirmReturnSchema),
  requestsController.confirmReturn,
);

export default router;
