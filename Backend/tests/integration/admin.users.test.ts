import request from '../setup/request';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertItem, insertReport, insertUser } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { createAdminUser } from '../setup/adminFactory';
import { db } from '../../src/config/db';
import { notifications, users } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/admin/users', () => {
  it('an admin sees ACTIVE, SUSPENDED, and DELETED users — unlike any public endpoint', async () => {
    const admin = await createAdminUser();
    await insertUser({ status: 'ACTIVE' });
    await insertUser({ status: 'SUSPENDED' });
    await insertUser({ status: 'DELETED' });

    const res = await request(app).get('/api/admin/users').set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    // admin itself + the 3 seeded users
    expect(res.body.pagination.totalItems).toBe(4);
    const statuses = res.body.users.map((u: { status: string }) => u.status).sort();
    expect(statuses).toEqual(['ACTIVE', 'ACTIVE', 'DELETED', 'SUSPENDED']);
    expect(res.body.users.every((u: { passwordHash?: string }) => u.passwordHash === undefined)).toBe(true);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const res = await request(app).get('/api/admin/users').set('Cookie', `accessToken=${regular.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('an unauthenticated request gets 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('status filter and search narrow correctly and combine as AND', async () => {
    const admin = await createAdminUser();
    await insertUser({ fullName: 'Jane Suspended', status: 'SUSPENDED' });
    await insertUser({ fullName: 'Jane Active', status: 'ACTIVE' });
    await insertUser({ fullName: 'Other Suspended', status: 'SUSPENDED' });

    const res = await request(app)
      .get('/api/admin/users')
      .query({ status: 'SUSPENDED', search: 'Jane' })
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].fullName).toBe('Jane Suspended');
  });

  it('rejects an unrecognized status value with 400', async () => {
    const admin = await createAdminUser();
    const res = await request(app)
      .get('/api/admin/users')
      .query({ status: 'NOT_A_STATUS' })
      .set('Cookie', `accessToken=${admin.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('pagination works', async () => {
    const admin = await createAdminUser();
    for (let i = 0; i < 5; i += 1) {
      await insertUser();
    }

    const res = await request(app)
      .get('/api/admin/users')
      .query({ page: 1, limit: 2 })
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.body.users).toHaveLength(2);
    // admin + 5 seeded = 6 total
    expect(res.body.pagination).toEqual({ page: 1, limit: 2, totalItems: 6, totalPages: 3 });
  });
});

describe('GET /api/admin/users/:id', () => {
  it('includes profile info, item count, and report history in both directions', async () => {
    const admin = await createAdminUser();
    const target = await registerAndLogin();
    const otherUser = await registerAndLogin();
    await insertItem({ ownerId: target.userId });
    await insertItem({ ownerId: target.userId });
    const filedReportId = await insertReport({ reporterId: target.userId, targetType: 'ITEM', targetId: (await insertItem({ ownerId: otherUser.userId })) });
    const againstReportId = await insertReport({ reporterId: otherUser.userId, targetType: 'USER', targetId: target.userId });

    const res = await request(app)
      .get(`/api/admin/users/${target.userId}`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(target.userId);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.itemCount).toBe(2);
    expect(res.body.reportsFiled.map((r: { id: string }) => r.id)).toEqual([filedReportId]);
    expect(res.body.reportsAgainst.map((r: { id: string }) => r.id)).toEqual([againstReportId]);
  });

  it('404 for a nonexistent id', async () => {
    const admin = await createAdminUser();
    const res = await request(app)
      .get('/api/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `accessToken=${admin.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const target = await registerAndLogin();
    const res = await request(app)
      .get(`/api/admin/users/${target.userId}`)
      .set('Cookie', `accessToken=${regular.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('an unauthenticated request gets 401', async () => {
    const target = await registerAndLogin();
    const res = await request(app).get(`/api/admin/users/${target.userId}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/users/:id/suspend', () => {
  it('succeeds on an ACTIVE user and sends an ACCOUNT_SUSPENDED notification', async () => {
    const admin = await createAdminUser();
    const target = await registerAndLogin();

    const res = await request(app)
      .post(`/api/admin/users/${target.userId}/suspend`)
      .set('Cookie', `accessToken=${admin.accessToken}`)
      .send({ reason: 'Repeated policy violations' });

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('SUSPENDED');

    const [userRow] = await db.select().from(users).where(eq(users.id, target.userId));
    expect(userRow.status).toBe('SUSPENDED');

    const notifs = await db.select().from(notifications).where(eq(notifications.userId, target.userId));
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('ACCOUNT_SUSPENDED');
    expect(notifs[0].message).toContain('Repeated policy violations');
  });

  it('rejects an already-SUSPENDED user with a clear error', async () => {
    const admin = await createAdminUser();
    const targetId = await insertUser({ status: 'SUSPENDED' });

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Cookie', `accessToken=${admin.accessToken}`)
      .send({ reason: 'Already suspended' });

    expect(res.status).toBe(409);
  });

  it('rejects a DELETED user', async () => {
    const admin = await createAdminUser();
    const targetId = await insertUser({ status: 'DELETED' });

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/suspend`)
      .set('Cookie', `accessToken=${admin.accessToken}`)
      .send({ reason: 'Should not work' });

    expect(res.status).toBe(409);
  });

  it('requires a reason', async () => {
    const admin = await createAdminUser();
    const target = await registerAndLogin();

    const res = await request(app)
      .post(`/api/admin/users/${target.userId}/suspend`)
      .set('Cookie', `accessToken=${admin.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const target = await registerAndLogin();

    const res = await request(app)
      .post(`/api/admin/users/${target.userId}/suspend`)
      .set('Cookie', `accessToken=${regular.accessToken}`)
      .send({ reason: 'Trying anyway' });

    expect(res.status).toBe(403);
  });

  it('an unauthenticated request gets 401', async () => {
    const target = await registerAndLogin();
    const res = await request(app).post(`/api/admin/users/${target.userId}/suspend`).send({ reason: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/users/:id/reactivate', () => {
  it('succeeds on a SUSPENDED user', async () => {
    const admin = await createAdminUser();
    const targetId = await insertUser({ status: 'SUSPENDED' });

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/reactivate`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('ACTIVE');

    const [userRow] = await db.select().from(users).where(eq(users.id, targetId));
    expect(userRow.status).toBe('ACTIVE');
  });

  it('rejects an ACTIVE user', async () => {
    const admin = await createAdminUser();
    const target = await registerAndLogin();

    const res = await request(app)
      .post(`/api/admin/users/${target.userId}/reactivate`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(409);
  });

  it('rejects a DELETED user', async () => {
    const admin = await createAdminUser();
    const targetId = await insertUser({ status: 'DELETED' });

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/reactivate`)
      .set('Cookie', `accessToken=${admin.accessToken}`);

    expect(res.status).toBe(409);
  });

  it('a non-admin gets 403', async () => {
    const regular = await registerAndLogin();
    const targetId = await insertUser({ status: 'SUSPENDED' });

    const res = await request(app)
      .post(`/api/admin/users/${targetId}/reactivate`)
      .set('Cookie', `accessToken=${regular.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('an unauthenticated request gets 401', async () => {
    const targetId = await insertUser({ status: 'SUSPENDED' });
    const res = await request(app).post(`/api/admin/users/${targetId}/reactivate`);
    expect(res.status).toBe(401);
  });
});
