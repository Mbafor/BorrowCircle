import { z } from 'zod';
import { LOCATIONS } from '../constants/locations';
import { PHONE_REGEX } from '../constants/phone';

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(255).optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(PHONE_REGEX, 'Enter a valid Ghanaian phone number (e.g. 0241234567 or +233241234567)')
      .optional(),
    location: z.enum(LOCATIONS, { invalid_type_error: 'Select a valid location' }).optional(),
    bio: z.string().trim().max(500, 'Bio must be at most 500 characters').nullable().optional(),
    profileImageUrl: z.string().trim().url('Enter a valid URL').nullable().optional(),
  })
  .strict();

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
