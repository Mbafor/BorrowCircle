import { db } from '../../src/config/db';
import { borrowRequests, items, notifications, passwordResetTokens, refreshTokens, users } from '../../src/db/schema';

export async function clearDatabase(): Promise<void> {
  await db.delete(notifications);
  await db.delete(passwordResetTokens);
  await db.delete(refreshTokens);
  await db.delete(borrowRequests);
  await db.delete(items);
  await db.delete(users);
}

export interface InsertItemOptions {
  ownerId: string;
  title?: string;
  description?: string;
  category?: string;
  location?: string;
  status?: 'AVAILABLE' | 'RESERVED' | 'BORROWED' | 'OVERDUE' | 'PAUSED' | 'CANCELLED' | 'REMOVED';
  borrowType?: 'FREE' | 'PAID';
  pricePerDay?: string | null;
  createdAt?: Date;
}

export async function insertItem(options: InsertItemOptions): Promise<string> {
  const [row] = await db
    .insert(items)
    .values({
      ownerId: options.ownerId,
      title: options.title ?? 'Scientific Calculator',
      description: options.description ?? 'Good condition.',
      category: options.category ?? 'Electronics',
      location: options.location ?? 'Republic Hall',
      borrowType: options.borrowType ?? 'FREE',
      status: options.status ?? 'AVAILABLE',
      ...(options.pricePerDay !== undefined ? { pricePerDay: options.pricePerDay } : {}),
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    })
    .returning();
  return row.id;
}

export type BorrowRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'BORROWED'
  | 'RETURNED'
  | 'OVERDUE';

export interface InsertBorrowRequestOptions {
  itemId: string;
  borrowerId: string;
  status?: BorrowRequestStatus;
  pickupDate?: string;
  returnDate?: string;
  message?: string | null;
  expiresAt?: Date;
  pickupCode?: string | null;
  returnCode?: string | null;
}

export async function insertBorrowRequest(options: InsertBorrowRequestOptions): Promise<string> {
  const [row] = await db
    .insert(borrowRequests)
    .values({
      itemId: options.itemId,
      borrowerId: options.borrowerId,
      status: options.status ?? 'PENDING',
      pickupDate: options.pickupDate ?? '2999-01-01',
      returnDate: options.returnDate ?? '2999-01-05',
      message: options.message ?? null,
      expiresAt: options.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000),
      ...(options.pickupCode !== undefined ? { pickupCode: options.pickupCode } : {}),
      ...(options.returnCode !== undefined ? { returnCode: options.returnCode } : {}),
    })
    .returning();
  return row.id;
}

export type NotificationType =
  | 'REQUEST_SENT'
  | 'REQUEST_ACCEPTED'
  | 'REQUEST_DECLINED'
  | 'REQUEST_CANCELLED'
  | 'REQUEST_EXPIRED'
  | 'ITEM_CANCELLED'
  | 'HANDOVER_CONFIRMED'
  | 'RETURN_CONFIRMED'
  | 'OVERDUE';

export interface InsertNotificationOptions {
  userId: string;
  type?: NotificationType;
  title?: string;
  message?: string;
  targetType?: 'ITEM' | 'BORROW_REQUEST';
  targetId: string;
  isRead?: boolean;
  createdAt?: Date;
}

export async function insertNotification(options: InsertNotificationOptions): Promise<string> {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: options.userId,
      type: options.type ?? 'REQUEST_SENT',
      title: options.title ?? 'Test notification',
      message: options.message ?? 'Test message',
      targetType: options.targetType ?? 'BORROW_REQUEST',
      targetId: options.targetId,
      isRead: options.isRead ?? false,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    })
    .returning();
  return row.id;
}
