import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { db } from '../config/db';
import { borrowRequests, items } from '../db/schema';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { CreateRequestBody } from '../validation/requests.validation';

export type BorrowRequestRow = typeof borrowRequests.$inferSelect;
export type BorrowRequestStatus = BorrowRequestRow['status'];

const EXPIRES_AFTER_MS = 48 * 60 * 60 * 1000;
const CANCELLABLE_STATUSES: BorrowRequestStatus[] = ['PENDING', 'ACCEPTED'];

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === '23505';
}

export async function createRequest(borrowerId: string, input: CreateRequestBody): Promise<BorrowRequestRow> {
  const [item] = await db.select().from(items).where(eq(items.id, input.itemId)).limit(1);
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  if (item.ownerId === borrowerId) {
    throw new ForbiddenError('You cannot request to borrow your own item');
  }

  if (item.status !== 'AVAILABLE') {
    throw new ConflictError(`This item is currently ${item.status} and cannot be requested`);
  }

  const [existingPending] = await db
    .select()
    .from(borrowRequests)
    .where(
      and(
        eq(borrowRequests.itemId, input.itemId),
        eq(borrowRequests.borrowerId, borrowerId),
        eq(borrowRequests.status, 'PENDING'),
      ),
    )
    .limit(1);
  if (existingPending) {
    throw new ConflictError('You already have a pending request for this item');
  }

  try {
    const [created] = await db
      .insert(borrowRequests)
      .values({
        itemId: input.itemId,
        borrowerId,
        pickupDate: input.pickupDate,
        returnDate: input.returnDate,
        message: input.message ?? null,
        expiresAt: new Date(Date.now() + EXPIRES_AFTER_MS),
      })
      .returning();

    // TODO(notifications): notify the item owner that a new borrow request
    // was sent. Feature 10 will wire this up.

    return created;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('You already have a pending request for this item');
    }
    throw err;
  }
}

export async function getMyRequests(borrowerId: string): Promise<BorrowRequestRow[]> {
  await expireStaleRequests();

  return db.select().from(borrowRequests).where(eq(borrowRequests.borrowerId, borrowerId)).orderBy(desc(borrowRequests.createdAt));
}

export async function getRequestById(requestId: string, requestingUserId: string): Promise<BorrowRequestRow> {
  await expireStaleRequests();

  const [row] = await db
    .select({ request: borrowRequests, itemOwnerId: items.ownerId })
    .from(borrowRequests)
    .leftJoin(items, eq(borrowRequests.itemId, items.id))
    .where(eq(borrowRequests.id, requestId))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Request not found');
  }

  const isBorrower = row.request.borrowerId === requestingUserId;
  const isItemOwner = row.itemOwnerId === requestingUserId;
  if (!isBorrower && !isItemOwner) {
    // Don't reveal that a request between two other people exists.
    throw new NotFoundError('Request not found');
  }

  return row.request;
}

export async function cancelRequest(requestId: string, borrowerId: string): Promise<BorrowRequestRow> {
  const [request] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
  if (!request) {
    throw new NotFoundError('Request not found');
  }

  if (request.borrowerId !== borrowerId) {
    throw new ForbiddenError('You do not have permission to cancel this request');
  }

  if (!CANCELLABLE_STATUSES.includes(request.status)) {
    throw new ConflictError(`Cannot cancel a request that is ${request.status}`);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(borrowRequests)
      .set({ status: 'CANCELLED' })
      .where(eq(borrowRequests.id, requestId))
      .returning();

    if (request.status === 'ACCEPTED') {
      // Not reachable until Feature 6 (accept) can set an item to RESERVED —
      // built now so Feature 6 doesn't need to touch this cancel path.
      await tx
        .update(items)
        .set({ status: 'AVAILABLE' })
        .where(and(eq(items.id, request.itemId), eq(items.status, 'RESERVED')));
    }

    // TODO(notifications): notify the item owner that this request was
    // cancelled. Feature 10 will wire this up.

    return updated;
  });
}

/**
 * Finds every PENDING request whose expiry has passed and marks it EXPIRED,
 * reverting the item to AVAILABLE if it had been left RESERVED (symmetric
 * with cancelRequest, not reachable until Feature 6 lands). Pure and
 * directly callable — used by both the cron job and the lazy calls in the
 * GET endpoints above, and tests call it directly rather than waiting on
 * real time.
 */
export async function expireStaleRequests(): Promise<number> {
  return db.transaction(async (tx) => {
    const stale = await tx
      .select()
      .from(borrowRequests)
      .where(and(eq(borrowRequests.status, 'PENDING'), lt(borrowRequests.expiresAt, new Date())));

    if (stale.length === 0) {
      return 0;
    }

    const staleIds = stale.map((r) => r.id);
    await tx.update(borrowRequests).set({ status: 'EXPIRED' }).where(inArray(borrowRequests.id, staleIds));

    const itemIds = stale.map((r) => r.itemId);
    await tx
      .update(items)
      .set({ status: 'AVAILABLE' })
      .where(and(inArray(items.id, itemIds), eq(items.status, 'RESERVED')));

    // TODO(notifications): notify each borrower that their pending request
    // expired. Feature 10 will wire this up.

    return staleIds.length;
  });
}
