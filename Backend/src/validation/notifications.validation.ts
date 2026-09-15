import { z } from 'zod';

const MAX_LIMIT = 50;

export const notificationsQuerySchema = z.object({
  read: z
    .enum(['true', 'false'], { invalid_type_error: 'read must be true or false' })
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
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

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
