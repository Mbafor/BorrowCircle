import request from '../setup/request';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { createAdminUser } from '../setup/adminFactory';
import { db } from '../../src/config/db';
import { borrowRequests, items, notifications } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/admin/items', () => {
  it('returns items of every status, including ones public browse would never return', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', title: 'Avail' });
    await insertItem({ ownerId: owner.userId, status: 'PAUSED', title: 'Paused' });
    await insertItem({ ownerId: owner.userId, status: 'CANCELLED', title: 'Cancelled' });
    await insertItem({ ownerId: owner.userId, status: 'REMOVED', title: 'Removed' });

    const res = await request(app).get('/api/admin/items').set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.totalItems).toBe(4);
    const statuses = res.body.items.map((i: { status: string }) => i.status).sort();
    expect(statuses).toEqual(['AVAILABLE', 'CANCELLED', 'PAUSED', 'REMOVED']);
  });

  it('status filter narrows to a single status not visible on public browse', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    await insertItem({ ownerId: owner.userId, status: 'CANCELLED' });

    const res = await request(app)
      .get('/api/admin/items')
      .query({ status: 'CANCELLED' })
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe('CANCELLED');
  });

  it('search filters by title/description and combines with status as AND', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, status: 'PAUSED', title: 'Graphing Calculator' });
    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', title: 'Graphing Calculator' });
    await insertItem({ ownerId: owner.userId, status: 'PAUSED', title: 'Lab Coat' });

    const res = await request(app)
      .get('/api/admin/items')
      .query({ status: 'PAUSED', search: 'Graphing' })
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Graphing Calculator');
    expect(res.body.items[0].status).toBe('PAUSED');
  });

  it('rejects an unrecognized status value with 400', async () => {
    const admin = await createAdminUser();
    const res = await request(app)
      .get('/api/admin/items')
      .query({ status: 'NOT_A_STATUS' })
      .set('Cookie', `accessToken=${admin.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const res = await request(app).get('/api/admin/items').set('Cookie', `accessToken=${regular.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('an unauthenticated request gets 401', async () => {
    const res = await request(app).get('/api/admin/items');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/items/:id/remove', () => {
  it.each(['AVAILABLE', 'PAUSED'] as const)(
    'succeeds when the item is %s: item becomes REMOVED, any PENDING request cancels, owner is notified',
    async (status) => {
      const admin = await createAdminUser();
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId, status });
      const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

      const res = await request(app)
        .post(`/api/admin/items/${itemId}/remove`)
        .set('Cookie', `accessToken=${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.item.status).toBe('REMOVED');

      const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
      expect(itemRow.status).toBe('REMOVED');

      const [requestRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
      expect(requestRow.status).toBe('CANCELLED');

      const ownerNotifs = await db.select().from(notifications).where(eq(notifications.userId, owner.userId));
      expect(ownerNotifs.some((n) => n.type === 'ITEM_CANCELLED')).toBe(true);
    },
  );

  it.each(['RESERVED', 'BORROWED', 'OVERDUE'] as const)(
    'is rejected when the item is %s, matching Feature 12\'s existing behavior exactly',
    async (status) => {
      const admin = await createAdminUser();
      const owner = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId, status });

      const res = await request(app)
        .post(`/api/admin/items/${itemId}/remove`)
        .set('Cookie', `accessToken=${admin.accessToken}`);

      expect(res.status).toBe(409);

      const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
      expect(itemRow.status).toBe(status);
    },
  );

  it('404 for a nonexistent item id', async () => {
    const admin = await createAdminUser();
    const res = await request(app)
      .post('/api/admin/items/00000000-0000-0000-0000-000000000000/remove')
      .set('Cookie', `accessToken=${admin.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app)
      .post(`/api/admin/items/${itemId}/remove`)
      .set('Cookie', `accessToken=${regular.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('an unauthenticated request gets 401', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const res = await request(app).post(`/api/admin/items/${itemId}/remove`);
    expect(res.status).toBe(401);
  });
});
