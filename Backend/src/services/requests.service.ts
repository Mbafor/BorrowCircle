import { and, desc, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { db, DbTransaction } from '../config/db';
import { borrowRequests, items } from '../db/schema';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { generateHandoverCode } from '../utils/token';
import { createNotification } from './notifications.service';
import { CreateRequestBody, IncomingRequestsQuery } from '../validation/requests.validation';

const OVERDUE_NOTIFICATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type BorrowRequestRow = typeof borrowRequests.$inferSelect;
export type BorrowRequestStatus = BorrowRequestRow['status'];

const EXPIRES_AFTER_MS = 48 * 60 * 60 * 1000;
const CANCELLABLE_STATUSES: BorrowRequestStatus[] = ['PENDING', 'ACCEPTED'];
const RETURNABLE_STATUSES: BorrowRequestStatus[] = ['BORROWED', 'OVERDUE'];
export const AUTO_DECLINE_REASON = 'Item was reserved by another borrower';

export function isCancellableStatus(status: BorrowRequestStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

// A request can only be accepted or declined while PENDING.
export function isActionableStatus(status: BorrowRequestStatus): boolean {
  return status === 'PENDING';
}

// A return code can only be accepted while BORROWED or OVERDUE (late is still returnable).
export function isReturnableStatus(status: BorrowRequestStatus): boolean {
  return RETURNABLE_STATUSES.includes(status);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === '23505';
}

/**
 * pickup_code / return_code are short-lived, low-stakes confirmation codes
 * exchanged face-to-face during a handover — not security credentials like
 * the password-reset tokens — so they're stored as plain values rather than
 * hashed. There's nothing meaningful to protect at rest: knowing a code
 * without also being physically present for the handover it gates is
 * useless, and they're generated fresh per request.
 */
// Borrower-facing view: never reveal return_code (that belongs to the owner).
export function toBorrowerView(row: BorrowRequestRow): BorrowRequestRow {
  return { ...row, returnCode: null };
}

// Owner-facing view: never reveal pickup_code (that belongs to the borrower).
export function toOwnerView(row: BorrowRequestRow): BorrowRequestRow {
  return { ...row, pickupCode: null };
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

    await createNotification({
      userId: item.ownerId,
      type: 'REQUEST_SENT',
      title: 'New borrow request',
      message: `You have a new request to borrow "${item.title}".`,
      targetType: 'BORROW_REQUEST',
      targetId: created.id,
    });

    return toBorrowerView(created);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('You already have a pending request for this item');
    }
    throw err;
  }
}

export async function getMyRequests(borrowerId: string): Promise<BorrowRequestRow[]> {
  await expireStaleRequests();
  await flagOverdueRequests();

  const rows = await db
    .select()
    .from(borrowRequests)
    .where(eq(borrowRequests.borrowerId, borrowerId))
    .orderBy(desc(borrowRequests.createdAt));

  return rows.map(toBorrowerView);
}

export async function getRequestById(requestId: string, requestingUserId: string): Promise<BorrowRequestRow> {
  await expireStaleRequests();
  await flagOverdueRequests();

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

  return isBorrower ? toBorrowerView(row.request) : toOwnerView(row.request);
}

export async function cancelRequest(requestId: string, borrowerId: string): Promise<BorrowRequestRow> {
  const [request] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
  if (!request) {
    throw new NotFoundError('Request not found');
  }

  if (request.borrowerId !== borrowerId) {
    throw new ForbiddenError('You do not have permission to cancel this request');
  }

  if (!isCancellableStatus(request.status)) {
    throw new ConflictError(`Cannot cancel a request that is ${request.status}`);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(borrowRequests)
      .set({ status: 'CANCELLED' })
      .where(eq(borrowRequests.id, requestId))
      .returning();

    if (request.status === 'ACCEPTED') {
      await tx
        .update(items)
        .set({ status: 'AVAILABLE' })
        .where(and(eq(items.id, request.itemId), eq(items.status, 'RESERVED')));
    }

    const [item] = await tx.select().from(items).where(eq(items.id, request.itemId)).limit(1);
    if (item) {
      await createNotification(
        {
          userId: item.ownerId,
          type: 'REQUEST_CANCELLED',
          title: 'Request withdrawn',
          message: `A borrower withdrew their request to borrow "${item.title}".`,
          targetType: 'BORROW_REQUEST',
          targetId: requestId,
        },
        tx,
      );
    }

    return toBorrowerView(updated);
  });
}

/**
 * Cancels every PENDING request on an item, as part of the caller's own
 * transaction (e.g. items.service.ts's updateItemStatus, when a lender
 * cancels the listing) — accepts that transaction's `tx` client rather than
 * starting its own, so the item's status change and this cascade commit or
 * roll back together. PENDING is the only request status that can coexist
 * with a cancellable (AVAILABLE/PAUSED) item; see items.service.ts for why.
 */
export async function cancelPendingRequestsForItem(
  tx: DbTransaction,
  itemId: string,
  itemTitle: string,
): Promise<number> {
  const cancelled = await tx
    .update(borrowRequests)
    .set({ status: 'CANCELLED' })
    .where(and(eq(borrowRequests.itemId, itemId), eq(borrowRequests.status, 'PENDING')))
    .returning({ id: borrowRequests.id, borrowerId: borrowRequests.borrowerId });

  // Reads distinctly from cancelRequest's borrower-initiated
  // REQUEST_CANCELLED above: this is the lender withdrawing the listing,
  // not the borrower cancelling their own request.
  for (const cancelledRequest of cancelled) {
    await createNotification(
      {
        userId: cancelledRequest.borrowerId,
        type: 'ITEM_CANCELLED',
        title: 'Listing cancelled',
        message: `The lender cancelled the listing "${itemTitle}", so your request was cancelled.`,
        targetType: 'ITEM',
        targetId: itemId,
      },
      tx,
    );
  }

  return cancelled.length;
}

/**
 * Finds every PENDING request whose expiry has passed and marks it EXPIRED,
 * reverting the item to AVAILABLE if it had been left RESERVED (symmetric
 * with cancelRequest). Pure and directly callable — used by both the cron
 * job and the lazy calls in the GET endpoints above, and tests call it
 * directly rather than waiting on real time.
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

    const itemRows = await tx.select({ id: items.id, title: items.title }).from(items).where(inArray(items.id, itemIds));
    const itemTitleById = new Map(itemRows.map((row) => [row.id, row.title]));

    for (const staleRequest of stale) {
      await createNotification(
        {
          userId: staleRequest.borrowerId,
          type: 'REQUEST_EXPIRED',
          title: 'Request expired',
          message: `Your request to borrow "${itemTitleById.get(staleRequest.itemId) ?? 'an item'}" expired because the owner didn't respond in time.`,
          targetType: 'BORROW_REQUEST',
          targetId: staleRequest.id,
        },
        tx,
      );
    }

    return staleIds.length;
  });
}

/**
 * Finds every BORROWED request whose return_date has passed with no
 * confirmed return and flags both it and its item OVERDUE. Same pattern as
 * expireStaleRequests(): pure, directly callable (used by the cron job and
 * the lazy calls in the GET endpoints below), and naturally idempotent — a
 * request already OVERDUE is no longer BORROWED, so a second run finds
 * nothing left to do.
 */
export async function flagOverdueRequests(): Promise<number> {
  const todayStr = new Date().toISOString().slice(0, 10);

  return db.transaction(async (tx) => {
    const newlyOverdue = await tx
      .select()
      .from(borrowRequests)
      .where(and(eq(borrowRequests.status, 'BORROWED'), lt(borrowRequests.returnDate, todayStr)));

    if (newlyOverdue.length > 0) {
      const overdueIds = newlyOverdue.map((r) => r.id);
      await tx.update(borrowRequests).set({ status: 'OVERDUE' }).where(inArray(borrowRequests.id, overdueIds));

      const itemIds = newlyOverdue.map((r) => r.itemId);
      await tx
        .update(items)
        .set({ status: 'OVERDUE' })
        .where(and(inArray(items.id, itemIds), eq(items.status, 'BORROWED')));
    }

    // Repeating notification: every request currently OVERDUE (including
    // ones just flagged above, whose last_overdue_notified_at is still
    // null) that hasn't been notified in the last 24h gets exactly one
    // notification now, and its timestamp is stamped so the next cron run
    // within 24h skips it. Once a request reaches RETURNED it's no longer
    // OVERDUE, so this WHERE clause excludes it automatically — no
    // special-case needed.
    const notifyCutoff = new Date(Date.now() - OVERDUE_NOTIFICATION_INTERVAL_MS);
    const dueForNotification = await tx
      .select({ request: borrowRequests, itemTitle: items.title, ownerId: items.ownerId })
      .from(borrowRequests)
      .innerJoin(items, eq(borrowRequests.itemId, items.id))
      .where(
        and(
          eq(borrowRequests.status, 'OVERDUE'),
          or(isNull(borrowRequests.lastOverdueNotifiedAt), lt(borrowRequests.lastOverdueNotifiedAt, notifyCutoff)),
        ),
      );

    for (const row of dueForNotification) {
      await createNotification(
        {
          userId: row.request.borrowerId,
          type: 'OVERDUE',
          title: 'Item overdue',
          message: `"${row.itemTitle}" is overdue. Please return it as soon as possible.`,
          targetType: 'BORROW_REQUEST',
          targetId: row.request.id,
        },
        tx,
      );
      await createNotification(
        {
          userId: row.ownerId,
          type: 'OVERDUE',
          title: 'Borrowed item overdue',
          message: `Your item "${row.itemTitle}" is overdue for return.`,
          targetType: 'BORROW_REQUEST',
          targetId: row.request.id,
        },
        tx,
      );
      await tx
        .update(borrowRequests)
        .set({ lastOverdueNotifiedAt: new Date() })
        .where(eq(borrowRequests.id, row.request.id));
    }

    return newlyOverdue.length;
  });
}

export async function getIncomingRequests(
  ownerId: string,
  filters: IncomingRequestsQuery,
): Promise<BorrowRequestRow[]> {
  await expireStaleRequests();

  if (filters.itemId) {
    const [item] = await db.select().from(items).where(eq(items.id, filters.itemId)).limit(1);
    if (!item || item.ownerId !== ownerId) {
      // Don't leak whether the item exists or belongs to someone else.
      return [];
    }
  }

  const conditions = [eq(items.ownerId, ownerId), eq(borrowRequests.status, filters.status)];
  if (filters.itemId) {
    conditions.push(eq(borrowRequests.itemId, filters.itemId));
  }

  const rows = await db
    .select({ request: borrowRequests })
    .from(borrowRequests)
    .innerJoin(items, eq(borrowRequests.itemId, items.id))
    .where(and(...conditions))
    .orderBy(desc(borrowRequests.createdAt));

  return rows.map((row) => toOwnerView(row.request));
}

/**
 * Accepts a PENDING request. The whole flow — locking the item, verifying
 * it's still AVAILABLE, accepting the target request, reserving the item,
 * and auto-declining every other PENDING request on it — happens in one
 * transaction so a concurrent accept on a different request for the same
 * item either fully loses (blocked on the item's row lock, then rejected
 * once it sees the item is no longer AVAILABLE) or fully wins; there's no
 * partial state. Only the item row is explicitly locked (SELECT ... FOR
 * UPDATE) — the request-row transitions use conditional UPDATE ... WHERE
 * status = 'PENDING' instead of an explicit lock, so this can never
 * deadlock against a concurrent decline() (which never touches the item).
 */
export async function acceptRequest(requestId: string, ownerId: string): Promise<BorrowRequestRow> {
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
    if (!request) {
      throw new NotFoundError('Request not found');
    }

    const [item] = await tx.select().from(items).where(eq(items.id, request.itemId)).for('update').limit(1);
    if (!item) {
      throw new NotFoundError('Item not found');
    }

    if (item.ownerId !== ownerId) {
      throw new ForbiddenError('You do not have permission to manage requests for this item');
    }

    if (!isActionableStatus(request.status)) {
      throw new ConflictError(`Cannot accept a request that is ${request.status}`);
    }

    if (item.status !== 'AVAILABLE') {
      throw new ConflictError(`This item is currently ${item.status} and cannot accept a request`);
    }

    const [accepted] = await tx
      .update(borrowRequests)
      .set({ status: 'ACCEPTED', pickupCode: generateHandoverCode() })
      .where(and(eq(borrowRequests.id, requestId), eq(borrowRequests.status, 'PENDING')))
      .returning();

    if (!accepted) {
      // Lost a race with something that changed this specific request
      // between the read above and here (e.g. a concurrent decline/cancel).
      const [current] = await tx.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
      throw new ConflictError(`Cannot accept a request that is ${current?.status ?? 'no longer available'}`);
    }

    await tx.update(items).set({ status: 'RESERVED' }).where(eq(items.id, item.id));

    const autoDeclined = await tx
      .update(borrowRequests)
      .set({ status: 'DECLINED', declineReason: AUTO_DECLINE_REASON })
      .where(and(eq(borrowRequests.itemId, item.id), eq(borrowRequests.status, 'PENDING'), ne(borrowRequests.id, requestId)))
      .returning({ id: borrowRequests.id, borrowerId: borrowRequests.borrowerId });

    await createNotification(
      {
        userId: accepted.borrowerId,
        type: 'REQUEST_ACCEPTED',
        title: 'Request accepted',
        message: `Your request to borrow "${item.title}" was accepted. Check your pickup code.`,
        targetType: 'BORROW_REQUEST',
        targetId: accepted.id,
      },
      tx,
    );

    for (const declinedRequest of autoDeclined) {
      await createNotification(
        {
          userId: declinedRequest.borrowerId,
          type: 'REQUEST_DECLINED',
          title: 'Request declined',
          message: `"${item.title}" was reserved by another borrower, so your request was declined.`,
          targetType: 'BORROW_REQUEST',
          targetId: declinedRequest.id,
        },
        tx,
      );
    }

    return toOwnerView(accepted);
  });
}

export async function declineRequest(
  requestId: string,
  ownerId: string,
  reason?: string,
): Promise<BorrowRequestRow> {
  const [request] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
  if (!request) {
    throw new NotFoundError('Request not found');
  }

  const [item] = await db.select().from(items).where(eq(items.id, request.itemId)).limit(1);
  if (!item || item.ownerId !== ownerId) {
    throw new ForbiddenError('You do not have permission to manage requests for this item');
  }

  if (!isActionableStatus(request.status)) {
    throw new ConflictError(`Cannot decline a request that is ${request.status}`);
  }

  const [declined] = await db
    .update(borrowRequests)
    .set({ status: 'DECLINED', declineReason: reason ?? null })
    .where(and(eq(borrowRequests.id, requestId), eq(borrowRequests.status, 'PENDING')))
    .returning();

  if (!declined) {
    const [current] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
    throw new ConflictError(`Cannot decline a request that is ${current?.status ?? 'no longer available'}`);
  }

  await createNotification({
    userId: declined.borrowerId,
    type: 'REQUEST_DECLINED',
    title: 'Request declined',
    message: reason
      ? `Your request to borrow "${item.title}" was declined: ${reason}`
      : `Your request to borrow "${item.title}" was declined.`,
    targetType: 'BORROW_REQUEST',
    targetId: declined.id,
  });

  return toOwnerView(declined);
}

/**
 * Owner confirms handover by entering the borrower's pickup code. On a
 * match: the request becomes BORROWED, the item becomes BORROWED, and a
 * one-time return_code is generated now (not at acceptance) since the
 * lender doesn't need it until the return date approaches.
 */
export async function confirmPickup(
  requestId: string,
  ownerId: string,
  pickupCode: string,
): Promise<BorrowRequestRow> {
  const [request] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
  if (!request) {
    throw new NotFoundError('Request not found');
  }

  const [item] = await db.select().from(items).where(eq(items.id, request.itemId)).limit(1);
  if (!item || item.ownerId !== ownerId) {
    throw new ForbiddenError('You do not have permission to manage this request');
  }

  if (request.status !== 'ACCEPTED') {
    throw new ConflictError(`Cannot confirm pickup for a request that is ${request.status}`);
  }

  if (request.pickupCode !== pickupCode) {
    throw new ValidationError({ pickupCode: 'Incorrect code' });
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(borrowRequests)
      .set({ status: 'BORROWED', returnCode: generateHandoverCode() })
      .where(and(eq(borrowRequests.id, requestId), eq(borrowRequests.status, 'ACCEPTED')))
      .returning();

    if (!updated) {
      const [current] = await tx.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
      throw new ConflictError(`Cannot confirm pickup for a request that is ${current?.status ?? 'no longer available'}`);
    }

    await tx.update(items).set({ status: 'BORROWED' }).where(eq(items.id, item.id));

    await createNotification(
      {
        userId: item.ownerId,
        type: 'HANDOVER_CONFIRMED',
        title: 'Pickup confirmed',
        message: `You confirmed pickup for "${item.title}".`,
        targetType: 'BORROW_REQUEST',
        targetId: updated.id,
      },
      tx,
    );
    await createNotification(
      {
        userId: updated.borrowerId,
        type: 'HANDOVER_CONFIRMED',
        title: 'Pickup confirmed',
        message: `Your pickup for "${item.title}" has been confirmed. Enjoy!`,
        targetType: 'BORROW_REQUEST',
        targetId: updated.id,
      },
      tx,
    );

    return toOwnerView(updated);
  });
}

/**
 * Borrower confirms return by entering the lender's return code. On a
 * match: the request becomes RETURNED, the item becomes AVAILABLE. Allowed
 * from BORROWED or OVERDUE — returning late is still a valid return.
 */
export async function confirmReturn(
  requestId: string,
  borrowerId: string,
  returnCode: string,
): Promise<BorrowRequestRow> {
  const [request] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
  if (!request) {
    throw new NotFoundError('Request not found');
  }

  if (request.borrowerId !== borrowerId) {
    throw new ForbiddenError('You do not have permission to confirm return for this request');
  }

  if (!isReturnableStatus(request.status)) {
    throw new ConflictError(`Cannot confirm return for a request that is ${request.status}`);
  }

  if (request.returnCode !== returnCode) {
    throw new ValidationError({ returnCode: 'Incorrect code' });
  }

  const [item] = await db.select().from(items).where(eq(items.id, request.itemId)).limit(1);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(borrowRequests)
      .set({ status: 'RETURNED', returnedAt: new Date() })
      .where(and(eq(borrowRequests.id, requestId), inArray(borrowRequests.status, RETURNABLE_STATUSES)))
      .returning();

    if (!updated) {
      const [current] = await tx.select().from(borrowRequests).where(eq(borrowRequests.id, requestId)).limit(1);
      throw new ConflictError(`Cannot confirm return for a request that is ${current?.status ?? 'no longer available'}`);
    }

    await tx.update(items).set({ status: 'AVAILABLE' }).where(eq(items.id, request.itemId));

    if (item) {
      await createNotification(
        {
          userId: item.ownerId,
          type: 'RETURN_CONFIRMED',
          title: 'Return confirmed',
          message: `"${item.title}" was returned by the borrower.`,
          targetType: 'BORROW_REQUEST',
          targetId: updated.id,
        },
        tx,
      );
      await createNotification(
        {
          userId: borrowerId,
          type: 'RETURN_CONFIRMED',
          title: 'Return confirmed',
          message: `Your return of "${item.title}" has been confirmed. Thanks!`,
          targetType: 'BORROW_REQUEST',
          targetId: updated.id,
        },
        tx,
      );
    }

    return toBorrowerView(updated);
  });
}
