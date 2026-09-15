import { and, asc, count, desc, eq, ilike, or, SQL, sql } from 'drizzle-orm';
import { db, DbTransaction } from '../config/db';
import { items, users } from '../db/schema';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { BrowseItemsQuery, CreateItemBody, UpdateItemBody } from '../validation/items.validation';
import { cancelPendingRequestsForItem } from './requests.service';
import { createNotification } from './notifications.service';

export type ItemRow = typeof items.$inferSelect;
export type ItemStatus = ItemRow['status'];

const EDITABLE_STATUSES: ItemStatus[] = ['AVAILABLE', 'PAUSED'];
const PUBLICLY_VISIBLE_STATUSES: ItemStatus[] = ['AVAILABLE', 'RESERVED', 'BORROWED', 'OVERDUE'];
const TERMINAL_STATUSES_WITH_CASCADE: ItemStatus[] = ['CANCELLED', 'REMOVED'];

// AVAILABLE/PAUSED can end in CANCELLED (owner-initiated, see updateItemStatus)
// or REMOVED (admin-initiated, see adminRemoveItem) — same reachable-from set
// and the same cascade, just a different terminal status and a different actor.
const STATUS_TRANSITIONS: Partial<Record<ItemStatus, ItemStatus[]>> = {
  AVAILABLE: ['PAUSED', 'CANCELLED', 'REMOVED'],
  PAUSED: ['AVAILABLE', 'CANCELLED', 'REMOVED'],
};

export function isValidStatusTransition(from: ItemStatus, to: ItemStatus): boolean {
  return (STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export function isEditableStatus(status: ItemStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/**
 * Cross-checks a requested price change against an item's (fixed, non-editable)
 * borrowType. Returns a field-error message, or null if the update is valid.
 */
export function validatePriceUpdate(
  borrowType: 'FREE' | 'PAID',
  newPricePerDay: number | null | undefined,
): string | null {
  if (newPricePerDay === undefined) {
    return null;
  }
  if (borrowType === 'FREE' && newPricePerDay !== null) {
    return 'A free item cannot have a price';
  }
  if (borrowType === 'PAID' && newPricePerDay === null) {
    return 'Price per day is required for a paid item';
  }
  return null;
}

async function getItemOrThrow(itemId: string): Promise<ItemRow> {
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) {
    throw new NotFoundError('Item not found');
  }
  return item;
}

async function getOwnedItemOrThrow(itemId: string, ownerId: string): Promise<ItemRow> {
  const item = await getItemOrThrow(itemId);
  if (item.ownerId !== ownerId) {
    throw new ForbiddenError('You do not have permission to modify this item');
  }
  return item;
}

export async function createItem(ownerId: string, input: CreateItemBody): Promise<ItemRow> {
  const [created] = await db
    .insert(items)
    .values({
      ownerId,
      title: input.title,
      description: input.description,
      category: input.category,
      location: input.location,
      borrowType: input.borrowType,
      pricePerDay: input.borrowType === 'PAID' ? input.pricePerDay!.toFixed(2) : null,
    })
    .returning();
  return created;
}

export async function getItemById(itemId: string, requestingUserId?: string): Promise<ItemRow> {
  const item = await getItemOrThrow(itemId);

  if (item.ownerId === requestingUserId) {
    return item;
  }

  if (!PUBLICLY_VISIBLE_STATUSES.includes(item.status)) {
    // Don't reveal that a paused/cancelled listing exists to a non-owner.
    throw new NotFoundError('Item not found');
  }

  return item;
}

export async function getOwnItems(ownerId: string): Promise<ItemRow[]> {
  return db.select().from(items).where(eq(items.ownerId, ownerId));
}

export async function updateItem(itemId: string, ownerId: string, input: UpdateItemBody): Promise<ItemRow> {
  const item = await getOwnedItemOrThrow(itemId, ownerId);

  if (!isEditableStatus(item.status)) {
    throw new ConflictError(`Cannot edit an item while it is ${item.status}`);
  }

  const newPricePerDay = input.pricePerDay;
  const hasPriceUpdate = newPricePerDay !== undefined;
  const priceError = validatePriceUpdate(item.borrowType, newPricePerDay);
  if (priceError) {
    throw new ValidationError({ pricePerDay: priceError });
  }

  const [updated] = await db
    .update(items)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(hasPriceUpdate ? { pricePerDay: newPricePerDay === null ? null : newPricePerDay.toFixed(2) } : {}),
    })
    .where(eq(items.id, itemId))
    .returning();

  return updated;
}

export async function deleteItem(itemId: string, ownerId: string): Promise<void> {
  const item = await getOwnedItemOrThrow(itemId, ownerId);

  if (!isEditableStatus(item.status)) {
    throw new ConflictError(`Cannot delete an item with an active borrow (status: ${item.status})`);
  }

  await db.delete(items).where(eq(items.id, itemId));
}

/**
 * Changes an item's status, cascading a cancellation to every PENDING
 * request on it in the same transaction (same locking pattern as Feature
 * 6's acceptRequest: lock the item row with SELECT ... FOR UPDATE, re-check
 * the transition against the locked row, then a conditional UPDATE as a
 * race backstop). Pausing/reactivating never touches requests — only a
 * transition to CANCELLED does. ACCEPTED/BORROWED/OVERDUE requests can't
 * exist on an item that's AVAILABLE or PAUSED (the only statuses this
 * transition is reachable from — see isValidStatusTransition), so PENDING
 * is the only request status the cascade needs to handle.
 */
/**
 * Core status-transition logic, shared by the owner-facing cancel/pause path
 * and the admin-facing remove path — same lock-check-cascade transaction
 * either way, just a different terminal status and (for the owner path) an
 * ownership check. Requires an already-open transaction from the caller so
 * it can be composed into a larger transaction (e.g. reports.service.ts
 * marking the report REVIEWED in the same operation).
 */
async function changeItemStatus(
  tx: DbTransaction,
  itemId: string,
  targetStatus: ItemStatus,
  requireOwnerId?: string,
): Promise<ItemRow> {
  const [item] = await tx.select().from(items).where(eq(items.id, itemId)).for('update').limit(1);
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  if (requireOwnerId !== undefined && item.ownerId !== requireOwnerId) {
    throw new ForbiddenError('You do not have permission to modify this item');
  }

  if (!isValidStatusTransition(item.status, targetStatus)) {
    throw new ConflictError(`Cannot change status from ${item.status} to ${targetStatus}`);
  }

  const [updated] = await tx
    .update(items)
    .set({ status: targetStatus })
    .where(and(eq(items.id, itemId), eq(items.status, item.status)))
    .returning();

  if (!updated) {
    // Lost a race with something else that changed this item's status
    // between the read above and here.
    const [current] = await tx.select().from(items).where(eq(items.id, itemId)).limit(1);
    throw new ConflictError(`Cannot change status from ${current?.status ?? 'unknown'} to ${targetStatus}`);
  }

  if (TERMINAL_STATUSES_WITH_CASCADE.includes(targetStatus)) {
    await cancelPendingRequestsForItem(tx, itemId, item.title);
  }

  return updated;
}

export async function updateItemStatus(itemId: string, ownerId: string, targetStatus: ItemStatus): Promise<ItemRow> {
  if (targetStatus === 'REMOVED') {
    // REMOVED is admin-only (see adminRemoveItem). The owner-facing route's
    // validation schema already excludes this value — this is a
    // defense-in-depth guard, not the primary enforcement.
    throw new ForbiddenError('Only an admin can remove a listing');
  }
  return db.transaction((tx) => changeItemStatus(tx, itemId, targetStatus, ownerId));
}

/**
 * Admin-only removal of a listing — called both from a report's remove-item
 * action and directly from services/admin.service.ts. No ownership check —
 * admin authorization is enforced by middleware/admin.middleware.ts at the
 * route layer, not here. Takes the caller's transaction so it can be
 * combined atomically with marking a triggering report REVIEWED. Notifies
 * the owner; any borrower with a PENDING request is separately notified by
 * the cascade inside changeItemStatus.
 */
export async function adminRemoveItem(tx: DbTransaction, itemId: string): Promise<ItemRow> {
  const updated = await changeItemStatus(tx, itemId, 'REMOVED');

  await createNotification(
    {
      userId: updated.ownerId,
      type: 'ITEM_CANCELLED',
      title: 'Listing removed',
      message: `Your listing "${updated.title}" was removed by an admin.`,
      targetType: 'ITEM',
      targetId: updated.id,
    },
    tx,
  );

  return updated;
}

export async function assertItemOwnership(itemId: string, ownerId: string): Promise<ItemRow> {
  return getOwnedItemOrThrow(itemId, ownerId);
}

export async function setItemImages(itemId: string, ownerId: string, imageUrls: string[]): Promise<ItemRow> {
  await getOwnedItemOrThrow(itemId, ownerId);

  const [updated] = await db.update(items).set({ imageUrls }).where(eq(items.id, itemId)).returning();
  return updated;
}

export interface BrowseItem {
  id: string;
  title: string;
  category: string;
  location: string;
  borrowType: 'FREE' | 'PAID';
  pricePerDay: string | null;
  status: ItemStatus;
  imageUrl: string | null;
  ownerId: string;
  ownerName: string;
  ownerAverageRating: string;
}

export interface BrowsePagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface BrowseResult {
  items: BrowseItem[];
  pagination: BrowsePagination;
}

/**
 * Builds the WHERE clause shared by the browse listing query and its count
 * query, so the two always agree on what "matches" means.
 */
export function buildBrowseWhereClause(
  filters: Pick<BrowseItemsQuery, 'search' | 'category' | 'location' | 'borrowType'>,
): SQL {
  const conditions: SQL[] = [eq(items.status, 'AVAILABLE')];

  if (filters.category) {
    conditions.push(eq(items.category, filters.category));
  }
  if (filters.location) {
    conditions.push(eq(items.location, filters.location));
  }
  if (filters.borrowType) {
    conditions.push(eq(items.borrowType, filters.borrowType));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(ilike(items.title, pattern), ilike(items.description, pattern)) as SQL);
  }

  return and(...conditions) as SQL;
}

// FREE items have no price; for price sorting they're treated as price 0, so
// ascending puts them first and descending puts them last alongside the
// cheapest paid items.
const PRICE_FOR_SORT = sql`COALESCE(${items.pricePerDay}, 0)`;

export function buildBrowseOrderBy(sortOption: BrowseItemsQuery['sort']): SQL {
  if (sortOption === 'price_asc') {
    return asc(PRICE_FOR_SORT);
  }
  if (sortOption === 'price_desc') {
    return desc(PRICE_FOR_SORT);
  }
  return desc(items.createdAt);
}

export async function browseItems(filters: BrowseItemsQuery): Promise<BrowseResult> {
  const whereClause = buildBrowseWhereClause(filters);
  const orderBy = buildBrowseOrderBy(filters.sort);
  const offset = (filters.page - 1) * filters.limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: items.id,
        title: items.title,
        category: items.category,
        location: items.location,
        borrowType: items.borrowType,
        pricePerDay: items.pricePerDay,
        status: items.status,
        imageUrls: items.imageUrls,
        ownerId: items.ownerId,
        ownerName: users.fullName,
        ownerAverageRating: users.averageRating,
      })
      .from(items)
      .leftJoin(users, eq(items.ownerId, users.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(filters.limit)
      .offset(offset),
    db.select({ value: count() }).from(items).where(whereClause),
  ]);

  const totalItems = Number(totalResult[0]?.value ?? 0);
  const totalPages = Math.ceil(totalItems / filters.limit);

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      location: row.location,
      borrowType: row.borrowType,
      pricePerDay: row.pricePerDay,
      status: row.status,
      imageUrl: row.imageUrls?.[0] ?? null,
      ownerId: row.ownerId,
      ownerName: row.ownerName ?? '',
      ownerAverageRating: row.ownerAverageRating ?? '0.00',
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages,
    },
  };
}
