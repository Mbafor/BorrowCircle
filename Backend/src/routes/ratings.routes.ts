import { Router } from 'express';
import * as ratingsController from '../controllers/ratings.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createRatingSchema } from '../validation/ratings.validation';

const router = Router();

router.post('/api/ratings', requireAuth, validate(createRatingSchema), ratingsController.create);
router.get('/api/ratings/my-pending', requireAuth, ratingsController.myPending);

export default router;
