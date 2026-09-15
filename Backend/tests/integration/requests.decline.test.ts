import request from '../setup/request';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { items } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('PATCH /api/requests/:id/decline', () => {
  it('declines a PENDING request with a reason', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/decline`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ reason: 'Already lent it to a friend' });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('DECLINED');
    expect(res.body.request.declineReason).toBe('Already lent it to a friend');
  });

  it('declines a PENDING request without a reason', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/decline`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('DECLINED');
    expect(res.body.request.declineReason).toBeNull();
  });

  it('does not change the item status — it stays AVAILABLE', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    await request(app)
      .patch(`/api/requests/${requestId}/decline`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({});

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item.status).toBe('AVAILABLE');
  });

  it('rejects a reason over 300 characters', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/decline`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ reason: 'a'.repeat(301) });

    expect(res.status).toBe(400);
  });

  it('a non-owner cannot decline', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/decline`)
      .set('Cookie', `accessToken=${stranger.accessToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it.each(['ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'] as const)(
    'rejects declining a request that is already %s, naming the actual status',
    async (status) => {
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId });
      const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status });

      const res = await request(app)
        .patch(`/api/requests/${requestId}/decline`)
        .set('Cookie', `accessToken=${owner.accessToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(status);
    },
  );

  it('returns 404 for an unknown request id', async () => {
    const owner = await registerAndLogin();
    const res = await request(app)
      .patch('/api/requests/00000000-0000-0000-0000-000000000000/decline')
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId });

    const res = await request(app).patch(`/api/requests/${requestId}/decline`).send({});
    expect(res.status).toBe(401);
  });
});
