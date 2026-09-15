import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertItem, insertReport } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { createAdminUser } from '../setup/adminFactory';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/reports', () => {
  it('an admin sees all reports', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const reporterA = await registerAndLogin();
    const reporterB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertReport({ reporterId: reporterA.userId, targetType: 'ITEM', targetId: itemId });
    await insertReport({ reporterId: reporterB.userId, targetType: 'ITEM', targetId: itemId });

    const res = await request(app).get('/api/reports').set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(2);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const res = await request(app).get('/api/reports').set('Cookie', `accessToken=${regular.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('defaults to OPEN and can be overridden', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId, status: 'OPEN' });
    await insertReport({
      reporterId: reporter.userId,
      targetType: 'ITEM',
      targetId: itemId,
      status: 'REVIEWED',
      note: 'already handled',
    });

    const openRes = await request(app).get('/api/reports').set('Cookie', `accessToken=${admin.accessToken}`);
    expect(openRes.body.reports).toHaveLength(1);
    expect(openRes.body.reports[0].status).toBe('OPEN');

    const reviewedRes = await request(app)
      .get('/api/reports')
      .query({ status: 'REVIEWED' })
      .set('Cookie', `accessToken=${admin.accessToken}`);
    expect(reviewedRes.body.reports).toHaveLength(1);
    expect(reviewedRes.body.reports[0].status).toBe('REVIEWED');
  });

  it('pagination works', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    for (let i = 0; i < 5; i += 1) {
      const reporter = await registerAndLogin();
      await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId });
    }

    const res = await request(app)
      .get('/api/reports')
      .query({ page: 1, limit: 2 })
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.body.reports).toHaveLength(2);
    expect(res.body.pagination).toEqual({ page: 1, limit: 2, totalItems: 5, totalPages: 3 });
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/reports/:id/review', () => {
  it('an admin can mark a report REVIEWED', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId });

    const res = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('REVIEWED');
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const reportId = await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId });

    const res = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set('Cookie', `accessToken=${regular.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects reviewing an already-REVIEWED report', async () => {
    const admin = await createAdminUser();
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const reportId = await insertReport({
      reporterId: reporter.userId,
      targetType: 'ITEM',
      targetId: itemId,
      status: 'REVIEWED',
    });

    const res = await request(app)
      .patch(`/api/reports/${reportId}/review`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown report id', async () => {
    const admin = await createAdminUser();
    const res = await request(app)
      .patch('/api/reports/00000000-0000-0000-0000-000000000000/review')
      .set('Cookie', `accessToken=${admin.accessToken}`);
    expect(res.status).toBe(404);
  });
});
