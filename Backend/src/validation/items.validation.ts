import { z } from 'zod';
import { CATEGORIES } from '../constants/categories';
import { LOCATIONS } from '../constants/locations';

const price = z.number().positive('Price per day must be greater than 0');

export const createItemSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title is too long'),
    description: z.string().trim().min(1, 'Description is required').max(2000, 'Description is too long'),
    category: z.enum(CATEGORIES, {
      required_error: 'Category is required',
      invalid_type_error: 'Select a valid category',
    }),
    location: z.enum(LOCATIONS, {
      required_error: 'Location is required',
      invalid_type_error: 'Select a valid location',
    }),
    borrowType: z.enum(['FREE', 'PAID'], { required_error: 'Borrow type is required' }),
    pricePerDay: price.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const hasPrice = data.pricePerDay !== undefined && data.pricePerDay !== null;
    if (data.borrowType === 'PAID' && !hasPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pricePerDay'],
        message: 'Price per day is required for a paid item',
      });
    }
    if (data.borrowType === 'FREE' && hasPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pricePerDay'],
        message: 'A free item cannot have a price',
      });
    }
  });

export const updateItemSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title is too long').optional(),
    description: z.string().trim().min(1, 'Description is required').max(2000, 'Description is too long').optional(),
    category: z.enum(CATEGORIES, { invalid_type_error: 'Select a valid category' }).optional(),
    location: z.enum(LOCATIONS, { invalid_type_error: 'Select a valid location' }).optional(),
    pricePerDay: price.nullable().optional(),
  })
  .strict();

export const updateItemStatusSchema = z.object({
  status: z.enum(['PAUSED', 'AVAILABLE', 'CANCELLED'], { required_error: 'Status is required' }),
});

const MAX_LIMIT = 50;

export const browseItemsQuerySchema = z.object({
  search: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().trim().max(200, 'Search term is too long').optional(),
  ),
  category: z.enum(CATEGORIES, { invalid_type_error: 'Select a valid category' }).optional(),
  location: z.enum(LOCATIONS, { invalid_type_error: 'Select a valid location' }).optional(),
  borrowType: z.enum(['FREE', 'PAID'], { invalid_type_error: 'Borrow type must be FREE or PAID' }).optional(),
  sort: z
    .enum(['newest', 'price_asc', 'price_desc'], { invalid_type_error: 'Invalid sort option' })
    .optional()
    .default('newest'),
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

export type CreateItemBody = z.infer<typeof createItemSchema>;
export type UpdateItemBody = z.infer<typeof updateItemSchema>;
export type UpdateItemStatusBody = z.infer<typeof updateItemStatusSchema>;
export type BrowseItemsQuery = z.infer<typeof browseItemsQuerySchema>;
