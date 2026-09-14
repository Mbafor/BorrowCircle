import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { items } from '../db/schema';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { CreateItemBody, UpdateItemBody } from '../validation/items.validation';

export type ItemRow = typeof items.$inferSelect;
export type ItemStatus = ItemRow['status'];

const EDITABLE_STATUSES: ItemStatus[] = ['AVAILABLE', 'PAUSED'];
const PUBLICLY_VISIBLE_STATUSES: ItemStatus[] = ['AVAILABLE', 'RESERVED', 'BORROWED', 'OVERDUE'];

const STATUS_TRANSITIONS: Partial<Record<ItemStatus, ItemStatus[]>> = {
  AVAILABLE: ['PAUSED', 'CANCELLED'],
  PAUSED: ['AVAILABLE', 'CANCELLED'],
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

export async function updateItemStatus(itemId: string, ownerId: string, targetStatus: ItemStatus): Promise<ItemRow> {
  const item = await getOwnedItemOrThrow(itemId, ownerId);

  if (!isValidStatusTransition(item.status, targetStatus)) {
    throw new ConflictError(`Cannot change status from ${item.status} to ${targetStatus}`);
  }

  // TODO(borrow-requests): when a lender cancels an item, any PENDING or
  // ACCEPTED borrow request on it must also be auto-cancelled and the
  // borrower notified. Not implemented — borrow_requests doesn't exist yet.

  const [updated] = await db.update(items).set({ status: targetStatus }).where(eq(items.id, itemId)).returning();
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
