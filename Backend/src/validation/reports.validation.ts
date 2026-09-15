import { z } from 'zod';

export const createReportSchema = z.object({
  targetType: z.enum(['ITEM', 'USER'], { required_error: 'targetType is required' }),
  targetId: z.string({ required_error: 'targetId is required' }).uuid('Invalid target id'),
  reason: z
    .string({ required_error: 'Reason is required' })
    .trim()
    .min(1, 'Reason is required')
    .max(100, 'Reason is too long'),
  note: z.string().trim().max(500, 'Note is too long').optional(),
});

const MAX_LIMIT = 50;

export const reportsQuerySchema = z.object({
  status: z
    .enum(['OPEN', 'REVIEWED'], { invalid_type_error: 'Invalid status value' })
    .optional()
    .default('OPEN'),
  page: z.coerce
    .number({ invalid_type_error: 'Page must be a number' })
    .int('Page must be an integer')
    .positive('Page must be positive')
    .optional()
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'Limit must be a number' })
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .optional()
    .default(20)
    .transform((value) => Math.min(value, MAX_LIMIT)),
});

export type CreateReportBody = z.infer<typeof createReportSchema>;
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;
