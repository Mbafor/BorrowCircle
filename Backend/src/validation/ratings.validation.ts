import { z } from 'zod';

const MAX_LIMIT = 50;

export const createRatingSchema = z.object({
  borrowRequestId: z.string({ required_error: 'borrowRequestId is required' }).uuid('Invalid request id'),
  score: z
    .number({ required_error: 'Score is required', invalid_type_error: 'Score must be a number' })
    .int('Score must be an integer')
    .min(1, 'Score must be between 1 and 5')
    .max(5, 'Score must be between 1 and 5'),
  comment: z.string().trim().max(500, 'Comment is too long').optional(),
});

export const reviewsQuerySchema = z.object({
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

export type CreateRatingBody = z.infer<typeof createRatingSchema>;
export type ReviewsQuery = z.infer<typeof reviewsQuerySchema>;
