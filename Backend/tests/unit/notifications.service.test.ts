import { eq } from 'drizzle-orm';
import { clearDatabase, insertItem, insertNotification } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { notifications } from '../../src/db/schema';
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../src/services/notifications.service';

beforeEach(async () => {
  await clearDatabase();
});

describe('createNotification', () => {
  it('inserts a notification row with the given fields', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });

    const created = await createNotification({
      userId: user.userId,
      type: 'ITEM_CANCELLED',
      title: 'Listing cancelled',
      message: 'Your item was cancelled.',
      targetType: 'ITEM',
      targetId: itemId,
    });

    expect(created.userId).toBe(user.userId);
    expect(created.type).toBe('ITEM_CANCELLED');
    expect(created.isRead).toBe(false);

    const [row] = await db.select().from(notifications).where(eq(notifications.id, created.id));
    expect(row.title).toBe('Listing cancelled');
    expect(row.targetId).toBe(itemId);
  });
});

describe('getNotifications', () => {
  it('returns only the given user\'s notifications, newest first', async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const itemA = await insertItem({ ownerId: userA.userId });

    const older = await insertNotification({ userId: userA.userId, targetId: itemA });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const newer = await insertNotification({ userId: userA.userId, targetId: itemA });
    await insertNotification({ userId: userB.userId, targetId: itemA });

    const result = await getNotifications(userA.userId, { page: 1, limit: 20 });

    expect(result.notifications.map((n) => n.id)).toEqual([newer, older]);
  });

  it('filters by read status', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: true });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: false });

    const unread = await getNotifications(user.userId, { read: false, page: 1, limit: 20 });
    expect(unread.notifications).toHaveLength(1);
    expect(unread.notifications[0].isRead).toBe(false);
  });
});

describe('getUnreadCount', () => {
  it('counts only unread notifications for the given user', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: false });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: false });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: true });

    const count = await getUnreadCount(user.userId);
    expect(count).toBe(2);
  });
});

describe('markNotificationRead', () => {
  it('marks the given notification read without affecting others', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    const target = await insertNotification({ userId: user.userId, targetId: itemId });
    const other = await insertNotification({ userId: user.userId, targetId: itemId });

    await markNotificationRead(target, user.userId);

    const [targetRow] = await db.select().from(notifications).where(eq(notifications.id, target));
    const [otherRow] = await db.select().from(notifications).where(eq(notifications.id, other));
    expect(targetRow.isRead).toBe(true);
    expect(otherRow.isRead).toBe(false);
  });

  it('rejects marking another user\'s notification as read', async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const notificationId = await insertNotification({ userId: owner.userId, targetId: itemId });

    await expect(markNotificationRead(notificationId, stranger.userId)).rejects.toThrow();
  });

  it('throws for an unknown notification id', async () => {
    const user = await registerAndLogin();
    await expect(markNotificationRead('00000000-0000-0000-0000-000000000000', user.userId)).rejects.toThrow();
  });
});

describe('markAllNotificationsRead', () => {
  it('marks all of the given user\'s unread notifications as read', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: false });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: false });

    const markedCount = await markAllNotificationsRead(user.userId);

    expect(markedCount).toBe(2);
    expect(await getUnreadCount(user.userId)).toBe(0);
  });

  it('does not touch another user\'s notifications', async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: userA.userId });
    await insertNotification({ userId: userA.userId, targetId: itemId, isRead: false });
    const bNotification = await insertNotification({ userId: userB.userId, targetId: itemId, isRead: false });

    await markAllNotificationsRead(userA.userId);

    const [bRow] = await db.select().from(notifications).where(eq(notifications.id, bNotification));
    expect(bRow.isRead).toBe(false);
  });
});
