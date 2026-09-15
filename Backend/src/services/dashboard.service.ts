import { and, count, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../config/db';
import { borrowRequests, items, users } from '../db/schema';
import { ItemStatus } from './items.service';
import { BorrowRequestStatus } from './requests.service';
import { BorrowingQuery, LendingQuery } from '../validation/dashboard.validation';

// A request still "in play" for the lender's dashboard view — once it's
// DECLINED/EXPIRED/CANCELLED/RETURNED there's nothing left to act on or track.
const NON_TERMINAL_REQUEST_STATUSES: BorrowRequestStatus[] = ['PENDING', 'ACCEPTED', 'BORROWED', 'OVERDUE'];
const ACTIVE_BORROW_STATUSES: BorrowRequestStatus[] = ['BORROWED', 'OVERDUE'];

export interface LendingActiveRequest {
  id: string;
  borrowerId: string;
  borrowerName: string;
  status: BorrowRequestStatus;
  pickupDate: string;
  returnDate: string;
}

export interface LendingItemRow {
  id: string;
  title: string;
  category: string;
  location: string;
  status: ItemStatus;
  createdAt: Date;
  activeRequest: LendingActiveRequest | null;
  pendingRequestCount: number;
}

export interface BorrowingRequestRow {
  id: string;
  itemId: string;
  itemTitle: string;
  itemCategory: string;
  lenderId: string;
  lenderName: string;
  status: BorrowRequestStatus;
  pickupDate: string;
  returnDate: string;
  createdAt: Date;
}

export interface DashboardPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface DashboardSummary {
  activeBorrows: number;
  itemsListed: number;
  pendingRequestsToReview: number;
  averageRating: string;
}

export interface ActiveRequestCandidate {
  itemId: string;
  status: BorrowRequestStatus;
}

/**
 * Given an item's non-terminal requests already ordered newest-first, picks
 * the most recent one per item and counts how many are PENDING per item.
 * Pure — no I/O — so it's unit-testable in isolation from the DB query that
 * feeds it.
 */
export function pickMostRecentRequestPerItem<T extends ActiveRequestCandidate>(
  rowsNewestFirst: T[],
): { mostRecentByItem: Map<string, T>; pendingCountByItem: Map<string, number> } {
  const mostRecentByItem = new Map<string, T>();
  const pendingCountByItem = new Map<string, number>();

  for (const row of rowsNewestFirst) {
    if (!mostRecentByItem.has(row.itemId)) {
      mostRecentByItem.set(row.itemId, row);
    }
    if (row.status === 'PENDING') {
      pendingCountByItem.set(row.itemId, (pendingCountByItem.get(row.itemId) ?? 0) + 1);
    }
  }

  return { mostRecentByItem, pendingCountByItem };
}

export async function getLendingDashboard(
  ownerId: string,
  filters: LendingQuery,
): Promise<{ items: LendingItemRow[]; pagination: DashboardPagination }> {
  const whereClause = filters.status
    ? and(eq(items.ownerId, ownerId), eq(items.status, filters.status))
    : eq(items.ownerId, ownerId);
  const offset = (filters.page - 1) * filters.limit;

  const [itemRows, totalResult] = await Promise.all([
    db
      .select()
      .from(items)
      .where(whereClause)
      .orderBy(desc(items.createdAt))
      .limit(filters.limit)
      .offset(offset),
    db.select({ value: count() }).from(items).where(whereClause),
  ]);

  const totalItems = Number(totalResult[0]?.value ?? 0);
  const itemIds = itemRows.map((item) => item.id);

  // Single follow-up query for every item on this page's non-terminal
  // requests, instead of one query per item.
  const requestRows =
    itemIds.length === 0
      ? []
      : await db
          .select({
            id: borrowRequests.id,
            itemId: borrowRequests.itemId,
            borrowerId: borrowRequests.borrowerId,
            borrowerName: users.fullName,
            status: borrowRequests.status,
            pickupDate: borrowRequests.pickupDate,
            returnDate: borrowRequests.returnDate,
          })
          .from(borrowRequests)
          .innerJoin(users, eq(borrowRequests.borrowerId, users.id))
          .where(and(inArray(borrowRequests.itemId, itemIds), inArray(borrowRequests.status, NON_TERMINAL_REQUEST_STATUSES)))
          .orderBy(desc(borrowRequests.createdAt));

  const { mostRecentByItem, pendingCountByItem } = pickMostRecentRequestPerItem(requestRows);

  return {
    items: itemRows.map((item) => {
      const mostRecent = mostRecentByItem.get(item.id);
      return {
        id: item.id,
        title: item.title,
        category: item.category,
        location: item.location,
        status: item.status,
        createdAt: item.createdAt,
        activeRequest: mostRecent
          ? {
              id: mostRecent.id,
              borrowerId: mostRecent.borrowerId,
              borrowerName: mostRecent.borrowerName,
              status: mostRecent.status,
              pickupDate: mostRecent.pickupDate,
              returnDate: mostRecent.returnDate,
            }
          : null,
        pendingRequestCount: pendingCountByItem.get(item.id) ?? 0,
      };
    }),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filters.limit),
    },
  };
}

export async function getBorrowingDashboard(
  borrowerId: string,
  filters: BorrowingQuery,
): Promise<{ requests: BorrowingRequestRow[]; pagination: DashboardPagination }> {
  const whereClause = filters.status
    ? and(eq(borrowRequests.borrowerId, borrowerId), eq(borrowRequests.status, filters.status))
    : eq(borrowRequests.borrowerId, borrowerId);
  const offset = (filters.page - 1) * filters.limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: borrowRequests.id,
        itemId: items.id,
        itemTitle: items.title,
        itemCategory: items.category,
        lenderId: items.ownerId,
        lenderName: users.fullName,
        status: borrowRequests.status,
        pickupDate: borrowRequests.pickupDate,
        returnDate: borrowRequests.returnDate,
        createdAt: borrowRequests.createdAt,
      })
      .from(borrowRequests)
      .innerJoin(items, eq(borrowRequests.itemId, items.id))
      .innerJoin(users, eq(items.ownerId, users.id))
      .where(whereClause)
      .orderBy(desc(borrowRequests.createdAt))
      .limit(filters.limit)
      .offset(offset),
    db.select({ value: count() }).from(borrowRequests).where(whereClause),
  ]);

  const totalItems = Number(totalResult[0]?.value ?? 0);

  return {
    requests: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filters.limit),
    },
  };
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const [activeBorrowsResult, itemsListedResult, pendingToReviewResult, [user]] = await Promise.all([
    db
      .select({ value: count() })
      .from(borrowRequests)
      .where(and(eq(borrowRequests.borrowerId, userId), inArray(borrowRequests.status, ACTIVE_BORROW_STATUSES))),
    db
      .select({ value: count() })
      .from(items)
      .where(and(eq(items.ownerId, userId), ne(items.status, 'CANCELLED'))),
    db
      .select({ value: count() })
      .from(borrowRequests)
      .innerJoin(items, eq(borrowRequests.itemId, items.id))
      .where(and(eq(items.ownerId, userId), eq(borrowRequests.status, 'PENDING'))),
    db.select({ averageRating: users.averageRating }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  return {
    activeBorrows: Number(activeBorrowsResult[0]?.value ?? 0),
    itemsListed: Number(itemsListedResult[0]?.value ?? 0),
    pendingRequestsToReview: Number(pendingToReviewResult[0]?.value ?? 0),
    averageRating: user?.averageRating ?? '0.00',
  };
}
