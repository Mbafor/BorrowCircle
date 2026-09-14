import { pgTable, uuid, varchar, text, decimal, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN']);
export const userStatusEnum = pgEnum('user_status', ['ACTIVE', 'SUSPENDED', 'DELETED']);

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 32 }).notNull().unique(),
  location: varchar('location', { length: 255 }).notNull(),
  profileImageUrl: text('profile_image_url'),
  bio: text('bio'),
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }).notNull().default('0'),
  role: userRoleEnum('role').notNull().default('USER'),
  status: userStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
