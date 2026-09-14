import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { forgotPasswordRateLimiter, loginRateLimiter, resetPasswordRateLimiter } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../validation/auth.validation';

const router = Router();

router.post('/api/auth/register', validate(registerSchema), authController.register);
router.post('/api/auth/login', loginRateLimiter, validate(loginSchema), authController.login);
router.post('/api/auth/logout', authController.logout);
router.post('/api/auth/refresh', authController.refresh);
router.post(
  '/api/auth/forgot-password',
  forgotPasswordRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  '/api/auth/reset-password',
  resetPasswordRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.get('/api/auth/me', requireAuth, authController.me);

export default router;
