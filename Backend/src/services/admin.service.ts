import { and, count, desc, eq, gte, ilike, or, SQL } from 'drizzle-orm';
import { db } from '../config/db';
import { borrowRequests, items, itemStatusEnum, reports, users } from '../db/schema';
import { NotFoundError } from '../utils/errors';
import * as itemsService from './items.service';
import * as usersService from './users.service';
import { ItemRow } from './items.service';
import { AdminItemsQuery, AdminUsersQuery } from '../validation/admin.validation';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  location: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  averageRating: string;
  createdAt: Date;
}

export interface AdminUserDetail {
  user: AdminUserSummary & { bio: string | null; profileImageUrl: string | null };
  itemCount: number;
  reportsFiled: (typeof reports.$inferSelect)[];
  reportsAgainst: (typeof reports.$inferSelect)[];
}

export interface AdminPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface AdminStats {
  totalUsers: number;
  totalItemsByStatus: Record<string, number>;
  openReports: number;
  requestsCompletedLast30Days: number;
}

// Never expose passwordHash to an admin-facing response.
function toAdminUserSummary(user: typeof users.$inferSelect): AdminUserSummary {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    location: user.location,
    role: user.role,
    status: user.status,
    averageRating: user.averageRating,
    createdAt: user.createdAt,
  };
}

/**
 * Builds the WHERE clause shared by the admin users listing query and its
 * count query. Unlike any public-facing endpoint, this deliberately has no
 * default status filter — SUSPENDED and DELETED users must be visible here.
 */
export function buildAdminUsersWhereClause(
  filters: Pick<AdminUsersQuery, 'status' | 'search'>,
): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.status) {
    conditions.push(eq(users.status, filters.status));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(ilike(users.fullName, pattern), ilike(users.email, pattern)) as SQL);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Builds the WHERE clause shared by the admin items listing query and its
 * count query. Unlike Feature 4's public browse (which always locks to
 * AVAILABLE), this has no default status filter — every status, including
 * PAUSED/CANCELLED/REMOVED, must be visible here.
 */
export function buildAdminItemsWhereClause(
  filters: Pick<AdminItemsQuery, 'status' | 'search'>,
): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.status) {
    conditions.push(eq(items.status, filters.status));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(ilike(items.title, pattern), ilike(items.description, pattern)) as SQL);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Fills in every item status with a 0 default, then overlays the grouped
 * counts actually returned by the DB — so a status with zero items still
 * appears in the response instead of being silently omitted. Pure, so it's
 * unit-testable without a database.
 */
export function buildItemStatusCounts(rows: { status: string; value: number | string }[]): Record<string, number> {
  const totalItemsByStatus: Record<string, number> = {};
  for (const status of itemStatusEnum.enumValues) {
    totalItemsByStatus[status] = 0;
  }
  for (const row of rows) {
    totalItemsByStatus[row.status] = Number(row.value);
  }
  return totalItemsByStatus;
}

export async function listUsers(
  filters: AdminUsersQuery,
): Promise<{ users: AdminUserSummary[]; pagination: AdminPagination }> {
  const whereClause = buildAdminUsersWhereClause(filters);
  const offset = (filters.page - 1) * filters.limit;

  const [rows, totalResult] = await Promise.all([
    db.select().from(users).where(whereClause).orderBy(desc(users.createdAt)).limit(filters.limit).offset(offset),
    db.select({ value: count() }).from(users).where(whereClause),
  ]);

  const totalItems = Number(totalResult[0]?.value ?? 0);

  return {
    users: rows.map(toAdminUserSummary),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filters.limit),
    },
  };
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const [itemCountResult, reportsFiled, reportsAgainst] = await Promise.all([
    db.select({ value: count() }).from(items).where(eq(items.ownerId, userId)),
    db.select().from(reports).where(eq(reports.reporterId, userId)).orderBy(desc(reports.createdAt)),
    db
      .select()
      .from(reports)
      .where(and(eq(reports.targetType, 'USER'), eq(reports.targetId, userId)))
      .orderBy(desc(reports.createdAt)),
  ]);

  return {
    user: { ...toAdminUserSummary(user), bio: user.bio, profileImageUrl: user.profileImageUrl },
    itemCount: Number(itemCountResult[0]?.value ?? 0),
    reportsFiled,
    reportsAgainst,
  };
}

export async function suspendUserDirect(userId: string, reason: string): Promise<AdminUserSummary> {
  const updated = await usersService.suspendUser(userId, reason);
  return toAdminUserSummary(updated);
}

export async function reactivateUserDirect(userId: string): Promise<AdminUserSummary> {
  const updated = await usersService.reactivateUser(userId);
  return toAdminUserSummary(updated);
}

export async function listItems(
  filters: AdminItemsQuery,
): Promise<{ items: ItemRow[]; pagination: AdminPagination }> {
  const whereClause = buildAdminItemsWhereClause(filters);
  const offset = (filters.page - 1) * filters.limit;

  const [rows, totalResult] = await Promise.all([
    db.select().from(items).where(whereClause).orderBy(desc(items.createdAt)).limit(filters.limit).offset(offset),
    db.select({ value: count() }).from(items).where(whereClause),
  ]);

  const totalItems = Number(totalResult[0]?.value ?? 0);

  return {
    items: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filters.limit),
    },
  };
}

export async function removeItemDirect(itemId: string): Promise<ItemRow> {
  return db.transaction((tx) => itemsService.adminRemoveItem(tx, itemId));
}

export async function getStats(): Promise<AdminStats> {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

  const [totalUsersResult, itemStatusRows, openReportsResult, completedResult] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ status: items.status, value: count() }).from(items).groupBy(items.status),
    db.select({ value: count() }).from(reports).where(eq(reports.status, 'OPEN')),
    db
      .select({ value: count() })
      .from(borrowRequests)
      .where(and(eq(borrowRequests.status, 'RETURNED'), gte(borrowRequests.returnedAt, cutoff))),
  ]);

  return {
    totalUsers: Number(totalUsersResult[0]?.value ?? 0),
    totalItemsByStatus: buildItemStatusCounts(itemStatusRows),
    openReports: Number(openReportsResult[0]?.value ?? 0),
    requestsCompletedLast30Days: Number(completedResult[0]?.value ?? 0),
  };
}
