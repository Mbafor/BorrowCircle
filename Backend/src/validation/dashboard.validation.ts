import { z } from 'zod';
import { itemStatusEnum } from '../db/schema/items';
import { borrowRequestStatusEnum } from '../db/schema/borrowRequests';

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

export const lendingQuerySchema = z.object({
  status: z.enum(itemStatusEnum.enumValues, { invalid_type_error: 'Invalid status value' }).optional(),
  page,
  limit,
});

export const borrowingQuerySchema = z.object({
  status: z.enum(borrowRequestStatusEnum.enumValues, { invalid_type_error: 'Invalid status value' }).optional(),
  page,
  limit,
});

export type LendingQuery = z.infer<typeof lendingQuerySchema>;
export type BorrowingQuery = z.infer<typeof borrowingQuerySchema>;
