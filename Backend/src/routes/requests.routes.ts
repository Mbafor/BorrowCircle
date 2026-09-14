import { Router } from 'express';
import * as requestsController from '../controllers/requests.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createRequestSchema } from '../validation/requests.validation';

const router = Router();

router.post('/api/requests', requireAuth, validate(createRequestSchema), requestsController.create);
router.get('/api/requests/mine', requireAuth, requestsController.getMine);
router.get('/api/requests/:id', requireAuth, requestsController.getById);
router.patch('/api/requests/:id/cancel', requireAuth, requestsController.cancel);

export default router;
