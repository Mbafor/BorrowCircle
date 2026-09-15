import { pgTable, uuid, integer, text, timestamp, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { borrowRequests } from './borrowRequests';
import { users } from './users';

export const ratings = pgTable(
  'ratings',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    borrowRequestId: uuid('borrow_request_id')
      .notNull()
      .references(() => borrowRequests.id),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id),
    revieweeId: uuid('reviewee_id')
      .notNull()
      .references(() => users.id),
    score: integer('score').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Enforced in the database, not just application code: a reviewer can
    // only rate a given borrow request once (each direction is a separate
    // row, so borrower and owner rating each other are both allowed).
    onePerDirection: uniqueIndex('ratings_borrow_request_id_reviewer_id_unique').on(
      table.borrowRequestId,
      table.reviewerId,
    ),
    scoreRange: check('ratings_score_range', sql`${table.score} >= 1 AND ${table.score} <= 5`),
  }),
);
