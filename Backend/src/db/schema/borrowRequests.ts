import { pgTable, uuid, date, text, varchar, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { items } from './items';
import { users } from './users';

export const borrowRequestStatusEnum = pgEnum('borrow_request_status', [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'BORROWED',
  'RETURNED',
  'OVERDUE',
]);

export const borrowRequests = pgTable(
  'borrow_requests',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    borrowerId: uuid('borrower_id')
      .notNull()
      .references(() => users.id),
    pickupDate: date('pickup_date', { mode: 'string' }).notNull(),
    returnDate: date('return_date', { mode: 'string' }).notNull(),
    message: text('message'),
    pickupCode: varchar('pickup_code', { length: 32 }),
    returnCode: varchar('return_code', { length: 32 }),
    status: borrowRequestStatusEnum('status').notNull().default('PENDING'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    itemIdIdx: index('borrow_requests_item_id_idx').on(table.itemId),
    borrowerIdIdx: index('borrow_requests_borrower_id_idx').on(table.borrowerId),
    // Enforced in the database, not just in application code: a borrower can
    // have at most one PENDING request per item at a time.
    onePendingPerItemPerBorrower: uniqueIndex('borrow_requests_one_pending_per_item_borrower')
      .on(table.itemId, table.borrowerId)
      .where(sql`${table.status} = 'PENDING'`),
  }),
);
