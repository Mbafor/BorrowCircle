import { z } from 'zod';
import { isAllowedEmailDomain } from '../services/auth.service';
import { LOCATIONS } from '../constants/locations';
import { PHONE_REGEX } from '../constants/phone';

const email = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .refine(isAllowedEmailDomain, {
    message: 'Only university email addresses are allowed to register',
  });

const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters');

export const registerSchema = z.object({
  fullName: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Full name must be at least 2 characters'),
  email,
  password,
  location: z.enum(LOCATIONS, {
    required_error: 'Location is required',
    invalid_type_error: 'Select a valid location',
  }),
  phoneNumber: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .regex(PHONE_REGEX, 'Enter a valid Ghanaian phone number (e.g. 0241234567 or +233241234567)'),
});

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string({ required_error: 'Reset token is required' }).min(1, 'Reset token is required'),
  newPassword: password,
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
