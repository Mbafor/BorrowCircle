import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertItem, insertNotification } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/notifications', () => {
  it("returns only the caller's own notifications, newest first", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const itemA = await insertItem({ ownerId: userA.userId });

    const older = await insertNotification({ userId: userA.userId, targetId: itemA });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const newer = await insertNotification({ userId: userA.userId, targetId: itemA });
    await insertNotification({ userId: userB.userId, targetId: itemA });

    const res = await request(app).get('/api/notifications').set('Cookie', `accessToken=${userA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.map((n: { id: string }) => n.id)).toEqual([newer, older]);
  });

  it('read filter narrows correctly', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: true });
    await insertNotification({ userId: user.userId, targetId: itemId, isRead: false });

    const unreadRes = await request(app)
      .get('/api/notifications')
      .query({ read: 'false' })
      .set('Cookie', `accessToken=${user.accessToken}`);
    expect(unreadRes.body.notifications).toHaveLength(1);
    expect(unreadRes.body.notifications[0].isRead).toBe(false);

    const readRes = await request(app)
      .get('/api/notifications')
      .query({ read: 'true' })
      .set('Cookie', `accessToken=${user.accessToken}`);
    expect(readRes.body.notifications).toHaveLength(1);
    expect(readRes.body.notifications[0].isRead).toBe(true);
  });

  it('pagination works', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    for (let i = 0; i < 5; i += 1) {
      await insertNotification({ userId: user.userId, targetId: itemId });
    }

    const page1 = await request(app)
      .get('/api/notifications')
      .query({ page: 1, limit: 2 })
      .set('Cookie', `accessToken=${user.accessToken}`);

    expect(page1.body.notifications).toHaveLength(2);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, totalItems: 5, totalPages: 3 });
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/notifications/unread-count', () => {
  it('matches the actual unread count and updates after marking some read', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    const n1 = await insertNotification({ userId: user.userId, targetId: itemId });
    await insertNotification({ userId: user.userId, targetId: itemId });

    const before = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', `accessToken=${user.accessToken}`);
    expect(before.body.count).toBe(2);

    await request(app).patch(`/api/notifications/${n1}/read`).set('Cookie', `accessToken=${user.accessToken}`);

    const after = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', `accessToken=${user.accessToken}`);
    expect(after.body.count).toBe(1);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/notifications/unread-count');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks one notification read without affecting others', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    const target = await insertNotification({ userId: user.userId, targetId: itemId });
    const other = await insertNotification({ userId: user.userId, targetId: itemId });

    const res = await request(app)
      .patch(`/api/notifications/${target}/read`)
      .set('Cookie', `accessToken=${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.notification.isRead).toBe(true);

    const list = await request(app).get('/api/notifications').set('Cookie', `accessToken=${user.accessToken}`);
    const otherRow = list.body.notifications.find((n: { id: string }) => n.id === other);
    expect(otherRow.isRead).toBe(false);
  });

  it("a user cannot mark another user's notification as read", async () => {
    const owner = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const notificationId = await insertNotification({ userId: owner.userId, targetId: itemId });

    const res = await request(app)
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Cookie', `accessToken=${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown notification id', async () => {
    const user = await registerAndLogin();
    const res = await request(app)
      .patch('/api/notifications/00000000-0000-0000-0000-000000000000/read')
      .set('Cookie', `accessToken=${user.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    const notificationId = await insertNotification({ userId: user.userId, targetId: itemId });
    const res = await request(app).patch(`/api/notifications/${notificationId}/read`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it("marks all of the caller's unread notifications as read", async () => {
    const user = await registerAndLogin();
    const itemId = await insertItem({ ownerId: user.userId });
    await insertNotification({ userId: user.userId, targetId: itemId });
    await insertNotification({ userId: user.userId, targetId: itemId });

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Cookie', `accessToken=${user.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.markedCount).toBe(2);

    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', `accessToken=${user.accessToken}`);
    expect(countRes.body.count).toBe(0);
  });

  it("does not touch another user's notifications", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: userA.userId });
    await insertNotification({ userId: userA.userId, targetId: itemId });
    await insertNotification({ userId: userB.userId, targetId: itemId });

    await request(app).patch('/api/notifications/read-all').set('Cookie', `accessToken=${userA.accessToken}`);

    const bCount = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', `accessToken=${userB.accessToken}`);
    expect(bCount.body.count).toBe(1);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).patch('/api/notifications/read-all');
    expect(res.status).toBe(401);
  });
});
