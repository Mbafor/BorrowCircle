import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem, insertReport, insertUser } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { createAdminUser } from '../setup/adminFactory';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/admin/stats', () => {
  it('totalUsers and totalItemsByStatus match a known seeded count exactly', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    await insertUser();
    await insertUser();

    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    await insertItem({ ownerId: owner.userId, status: 'PAUSED' });
    await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    await insertItem({ ownerId: owner.userId, status: 'OVERDUE' });
    await insertItem({ ownerId: owner.userId, status: 'CANCELLED' });
    await insertItem({ ownerId: owner.userId, status: 'REMOVED' });

    const res = await request(app).get('/api/admin/stats').set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    // admin + owner + 2 seeded = 4 users
    expect(res.body.totalUsers).toBe(4);
    expect(res.body.totalItemsByStatus).toEqual({
      AVAILABLE: 2,
      PAUSED: 1,
      RESERVED: 1,
      BORROWED: 1,
      OVERDUE: 1,
      CANCELLED: 1,
      REMOVED: 1,
    });
  });

  it('openReports counts only OPEN, not REVIEWED', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const reporterA = await registerAndLogin();
    const reporterB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertReport({ reporterId: reporterA.userId, targetType: 'ITEM', targetId: itemId, status: 'OPEN' });
    await insertReport({ reporterId: reporterB.userId, targetType: 'ITEM', targetId: itemId, status: 'REVIEWED' });

    const res = await request(app).get('/api/admin/stats').set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.body.openReports).toBe(1);
  });

  it('requestsCompletedLast30Days excludes a RETURNED request older than 30 days and includes one within the window', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemA = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const itemB = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    await insertBorrowRequest({
      itemId: itemA,
      borrowerId: borrower.userId,
      status: 'RETURNED',
      returnedAt: fortyDaysAgo,
    });
    await insertBorrowRequest({
      itemId: itemB,
      borrowerId: borrower.userId,
      status: 'RETURNED',
      returnedAt: fiveDaysAgo,
    });
    // A non-RETURNED request should never count, even if recent.
    await insertBorrowRequest({ itemId: itemA, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app).get('/api/admin/stats').set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.body.requestsCompletedLast30Days).toBe(1);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const res = await request(app).get('/api/admin/stats').set('Cookie', `accessToken=${regular.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('an unauthenticated request gets 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });
});
