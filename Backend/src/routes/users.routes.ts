import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadSinglePhoto } from '../middleware/upload.middleware';
import { validate, validateQuery } from '../middleware/validate.middleware';
import { updateProfileSchema } from '../validation/users.validation';
import { reviewsQuerySchema } from '../validation/ratings.validation';

const router = Router();

router.get('/api/users/me', requireAuth, usersController.getMe);
router.patch('/api/users/me', requireAuth, validate(updateProfileSchema), usersController.updateMe);
router.post('/api/users/me/photo', requireAuth, uploadSinglePhoto, usersController.uploadPhoto);
router.delete('/api/users/me', requireAuth, usersController.deleteMe);
router.get('/api/users/:id', usersController.getPublicProfile);
router.get('/api/users/:id/reviews', validateQuery(reviewsQuerySchema), usersController.getReviews);

export default router;
