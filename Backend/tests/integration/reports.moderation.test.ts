import request from '../setup/request';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem, insertReport } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { createAdminUser } from '../setup/adminFactory';
import { db } from '../../src/config/db';
import { borrowRequests, items, notifications, reports, users } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/reports/:id/remove-item', () => {
  it.each(['AVAILABLE', 'PAUSED'] as const)(
    'succeeds on an ITEM-targeted report when the item is %s: item becomes REMOVED, PENDING requests cancel, report becomes REVIEWED',
    async (status) => {
      const admin = await createAdminUser();
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const reporter = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId, status });
      const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });
      const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId });

      const res = await request(app)
        .post(`/api/reports/${reportId}/remove-item`)
        .set('Cookie', `accessToken=${admin.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.report.status).toBe('REVIEWED');

      const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
      expect(itemRow.status).toBe('REMOVED');

      const [requestRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
      expect(requestRow.status).toBe('CANCELLED');

      // Feature 13: adminRemoveItem (shared with the direct admin-dashboard
      // path) now notifies the owner too.
      const ownerNotifs = await db.select().from(notifications).where(eq(notifications.userId, owner.userId));
      expect(ownerNotifs.some((n) => n.type === 'ITEM_CANCELLED')).toBe(true);
    },
  );

  it.each(['RESERVED', 'BORROWED', 'OVERDUE'] as const)('is rejected when the item is %s', async (status) => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status });
    const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId });

    const res = await request(app)
      .post(`/api/reports/${reportId}/remove-item`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(409);

    const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
    expect(itemRow.status).toBe(status);

    const [reportRow] = await db.select().from(reports).where(eq(reports.id, reportId));
    expect(reportRow.status).toBe('OPEN');
  });

  it('is rejected on a USER-targeted report', async () => {
    const admin = await createAdminUser();
    const target = await registerAndLogin();
    const reporter = await registerAndLogin();
    const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'USER', targetId: target.userId });

    const res = await request(app)
      .post(`/api/reports/${reportId}/remove-item`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(409);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId });

    const res = await request(app)
      .post(`/api/reports/${reportId}/remove-item`)
      .set('Cookie', `accessToken=${regular.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('is rejected if the report is already REVIEWED', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const reportId = await insertReport({
      reporterId: reporter.userId,
      targetType: 'ITEM',
      targetId: itemId,
      status: 'REVIEWED',
    });

    const res = await request(app)
      .post(`/api/reports/${reportId}/remove-item`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(409);
  });
});

describe('POST /api/reports/:id/suspend-user', () => {
  it('succeeds on a USER-targeted report: user becomes SUSPENDED, report becomes REVIEWED', async () => {
    const admin = await createAdminUser();
    const target = await registerAndLogin();
    const reporter = await registerAndLogin();
    const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'USER', targetId: target.userId });

    const res = await request(app)
      .post(`/api/reports/${reportId}/suspend-user`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('REVIEWED');

    const [userRow] = await db.select().from(users).where(eq(users.id, target.userId));
    expect(userRow.status).toBe('SUSPENDED');

    // Feature 13: suspendUser (shared with the direct admin-dashboard path)
    // now notifies the suspended user too.
    const targetNotifs = await db.select().from(notifications).where(eq(notifications.userId, target.userId));
    expect(targetNotifs.some((n) => n.type === 'ACCOUNT_SUSPENDED')).toBe(true);
  });

  it('is rejected on an ITEM-targeted report', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId });

    const res = await request(app)
      .post(`/api/reports/${reportId}/suspend-user`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(409);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const target = await registerAndLogin();
    const reporter = await registerAndLogin();
    const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'USER', targetId: target.userId });

    const res = await request(app)
      .post(`/api/reports/${reportId}/suspend-user`)
      .set('Cookie', `accessToken=${regular.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('is rejected if the report is already REVIEWED', async () => {
    const admin = await createAdminUser();
    const target = await registerAndLogin();
    const reporter = await registerAndLogin();
    const reportId = await insertReport({
      reporterId: reporter.userId,
      targetType: 'USER',
      targetId: target.userId,
      status: 'REVIEWED',
    });

    const res = await request(app)
      .post(`/api/reports/${reportId}/suspend-user`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(409);
  });
});
