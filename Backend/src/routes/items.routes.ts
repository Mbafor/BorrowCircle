import { Router } from 'express';
import * as itemsController from '../controllers/items.controller';
import { attachUserIfPresent, requireAuth } from '../middleware/auth.middleware';
import { uploadItemImageFiles } from '../middleware/upload.middleware';
import { validate, validateQuery } from '../middleware/validate.middleware';
import {
  browseItemsQuerySchema,
  createItemSchema,
  updateItemSchema,
  updateItemStatusSchema,
} from '../validation/items.validation';

const router = Router();

router.get('/api/items', validateQuery(browseItemsQuerySchema), itemsController.browse);
router.post('/api/items', requireAuth, validate(createItemSchema), itemsController.create);
router.get('/api/items/mine', requireAuth, itemsController.getMine);
router.get('/api/items/:id', attachUserIfPresent, itemsController.getById);
router.patch('/api/items/:id', requireAuth, validate(updateItemSchema), itemsController.update);
router.delete('/api/items/:id', requireAuth, itemsController.remove);
router.patch(
  '/api/items/:id/status',
  requireAuth,
  validate(updateItemStatusSchema),
  itemsController.updateStatus,
);
router.post('/api/items/:id/images', requireAuth, uploadItemImageFiles, itemsController.uploadImages);

export default router;
