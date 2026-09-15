import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const notificationTypeEnum = pgEnum('notification_type', [
  'REQUEST_SENT',
  'REQUEST_ACCEPTED',
  'REQUEST_DECLINED',
  'REQUEST_CANCELLED',
  'REQUEST_EXPIRED',
  'ITEM_CANCELLED',
  'HANDOVER_CONFIRMED',
  'RETURN_CONFIRMED',
  'OVERDUE',
  'RATING_RECEIVED',
  'ACCOUNT_SUSPENDED',
]);

// A notification can be about an item listing, a borrow request, or (for
// ACCOUNT_SUSPENDED) the recipient's own account — so target_id is a plain
// uuid rather than a foreign key to any one of those tables — there's no
// single column that could carry all three relationships cleanly.
export const notificationTargetTypeEnum = pgEnum('notification_target_type', ['ITEM', 'BORROW_REQUEST', 'USER']);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    targetType: notificationTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    // Every list/unread-count query filters by (user_id, is_read).
    userIdIsReadIdx: index('notifications_user_id_is_read_idx').on(table.userId, table.isRead),
  }),
);
