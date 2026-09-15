import { z } from 'zod';
import { userStatusEnum } from '../db/schema/users';
import { itemStatusEnum } from '../db/schema/items';

const MAX_LIMIT = 50;

const page = z.coerce
  .number({ invalid_type_error: 'Page must be a number' })
  .int('Page must be an integer')
  .positive('Page must be positive')
  .optional()
  .default(1);

const limit = z.coerce
  .number({ invalid_type_error: 'Limit must be a number' })
  .int('Limit must be an integer')
  .positive('Limit must be positive')
  .optional()
  .default(20)
  .transform((value) => Math.min(value, MAX_LIMIT));

const search = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().trim().max(200, 'Search term is too long').optional(),
);

export const adminUsersQuerySchema = z.object({
  status: z.enum(userStatusEnum.enumValues, { invalid_type_error: 'Invalid status value' }).optional(),
  search,
  page,
  limit,
});

export const adminItemsQuerySchema = z.object({
  status: z.enum(itemStatusEnum.enumValues, { invalid_type_error: 'Invalid status value' }).optional(),
  search,
  page,
  limit,
});

export const suspendUserBodySchema = z.object({
  reason: z
    .string({ required_error: 'Reason is required' })
    .trim()
    .min(1, 'Reason is required')
    .max(300, 'Reason is too long'),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminItemsQuery = z.infer<typeof adminItemsQuerySchema>;
export type SuspendUserBody = z.infer<typeof suspendUserBodySchema>;
