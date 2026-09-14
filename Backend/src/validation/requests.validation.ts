import { z } from 'zod';
import { borrowRequestStatusEnum } from '../db/schema/borrowRequests';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format');

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export const createRequestSchema = z
  .object({
    itemId: z.string({ required_error: 'itemId is required' }).uuid('Invalid item id'),
    pickupDate: dateOnly,
    returnDate: dateOnly,
    message: z.string().trim().max(500, 'Message is too long').optional(),
  })
  .superRefine((data, ctx) => {
    const pickup = toUtcDate(data.pickupDate);
    const returnD = toUtcDate(data.returnDate);

    if (returnD <= pickup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['returnDate'],
        message: 'Return date must be after pickup date',
      });
    }

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (pickup < todayUtc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pickupDate'],
        message: 'Pickup date cannot be in the past',
      });
    }
  });

export const declineRequestSchema = z.object({
  reason: z.string().trim().max(300, 'Reason is too long').optional(),
});

export const incomingRequestsQuerySchema = z.object({
  status: z
    .enum(borrowRequestStatusEnum.enumValues, { invalid_type_error: 'Invalid status value' })
    .optional()
    .default('PENDING'),
  itemId: z.string().uuid('Invalid item id').optional(),
});

export type CreateRequestBody = z.infer<typeof createRequestSchema>;
export type DeclineRequestBody = z.infer<typeof declineRequestSchema>;
export type IncomingRequestsQuery = z.infer<typeof incomingRequestsQuerySchema>;
