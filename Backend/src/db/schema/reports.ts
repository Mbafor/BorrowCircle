import { pgTable, uuid, varchar, text, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const reportTargetTypeEnum = pgEnum('report_target_type', ['ITEM', 'USER']);
export const reportStatusEnum = pgEnum('report_status', ['OPEN', 'REVIEWED']);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    // target_id can reference either items or users depending on
    // target_type, so it's a plain uuid rather than a foreign key —
    // existence is validated in application logic instead (same reasoning
    // as notifications.target_id).
    targetType: reportTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: varchar('reason', { length: 100 }).notNull(),
    note: text('note'),
    status: reportStatusEnum('status').notNull().default('OPEN'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('reports_status_idx').on(table.status),
    // Enforced in the database, not just application code, matching the
    // pattern used for duplicate borrow requests (Feature 5) and duplicate
    // ratings (Feature 11): a reporter can have at most one OPEN report per
    // target at a time.
    oneOpenPerReporterTarget: uniqueIndex('reports_one_open_per_reporter_target')
      .on(table.reporterId, table.targetType, table.targetId)
      .where(sql`${table.status} = 'OPEN'`),
  }),
);
