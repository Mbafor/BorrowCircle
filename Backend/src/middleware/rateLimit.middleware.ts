import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export const loginRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many login attempts. Please try again later.' },
});

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many password reset requests. Please try again later.' },
});

export const resetPasswordRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many password reset attempts. Please try again later.' },
});
