import { pgTable, uuid, varchar, text, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const borrowTypeEnum = pgEnum('borrow_type', ['FREE', 'PAID']);
export const itemStatusEnum = pgEnum('item_status', [
  'AVAILABLE',
  'RESERVED',
  'BORROWED',
  'OVERDUE',
  'PAUSED',
  'CANCELLED',
  'REMOVED',
]);

export const items = pgTable('items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  // Up to 3 photo URLs; the 3-item cap is enforced in application code, not here.
  imageUrls: text('image_urls').array(),
  borrowType: borrowTypeEnum('borrow_type').notNull(),
  pricePerDay: decimal('price_per_day', { precision: 10, scale: 2 }),
  status: itemStatusEnum('status').notNull().default('AVAILABLE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
