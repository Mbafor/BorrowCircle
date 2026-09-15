import { and, count, desc, eq } from 'drizzle-orm';
import { db, DbTransaction } from '../config/db';
import { notifications } from '../db/schema';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export type NotificationRow = typeof notifications.$inferSelect;
export type NotificationType = NotificationRow['type'];
export type NotificationTargetType = NotificationRow['targetType'];

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  targetType: NotificationTargetType;
  targetId: string;
}

export interface NotificationsFilters {
  read?: boolean;
  page: number;
  limit: number;
}

export interface NotificationsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/**
 * The single entry point for creating a notification — every other feature
 * should call this rather than inserting into the notifications table
 * directly, so the shape stays consistent everywhere. Pass the caller's
 * transaction client (`tx`) when the notification should commit atomically
 * with the state change that triggered it; omitted, it uses the plain pool
 * connection.
 */
export async function createNotification(
  input: CreateNotificationInput,
  tx: DbTransaction | typeof db = db,
): Promise<NotificationRow> {
  const [created] = await tx
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      targetType: input.targetType,
      targetId: input.targetId,
    })
    .returning();
  return created;
}

export async function getNotifications(
  userId: string,
  filters: NotificationsFilters,
): Promise<{ notifications: NotificationRow[]; pagination: NotificationsPagination }> {
  const whereClause =
    filters.read !== undefined
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, filters.read))
      : eq(notifications.userId, userId);
  const offset = (filters.page - 1) * filters.limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(filters.limit)
      .offset(offset),
    db.select({ value: count() }).from(notifications).where(whereClause),
  ]);

  const totalItems = Number(totalResult[0]?.value ?? 0);

  return {
    notifications: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filters.limit),
    },
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(result?.value ?? 0);
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<NotificationRow> {
  const [notification] = await db.select().from(notifications).where(eq(notifications.id, notificationId)).limit(1);
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  if (notification.userId !== userId) {
    throw new ForbiddenError('You do not have permission to modify this notification');
  }

  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId))
    .returning();
  return updated;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .returning({ id: notifications.id });
  return updated.length;
}
