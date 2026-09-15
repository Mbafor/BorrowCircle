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

describe('PATCH /api/requests/:id/cancel', () => {
  it('cancels a PENDING request', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/cancel`)
      .set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('CANCELLED');
  });

  // Before Feature 6 existed, this test had to synthesize ACCEPTED/RESERVED
  // state directly via the DB, since nothing could produce it yet.
  it('cancels an ACCEPTED request and reverts the item to AVAILABLE (state synthesized directly)', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'ACCEPTED' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/cancel`)
      .set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('CANCELLED');

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item.status).toBe('AVAILABLE');
  });

  // Now that Feature 6 (accept) exists, this is the real end-to-end path:
  // send -> accept -> cancel, with no synthesized state.
  it('end-to-end: after a real accept, the borrower can still cancel and the item reverts to AVAILABLE', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const acceptRes = await request(app)
      .patch(`/api/requests/${requestId}/accept`)
      .set('Cookie', `accessToken=${owner.accessToken}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.request.status).toBe('ACCEPTED');

    const [reservedItem] = await db.select().from(items).where(eq(items.id, itemId));
    expect(reservedItem.status).toBe('RESERVED');

    const cancelRes = await request(app)
      .patch(`/api/requests/${requestId}/cancel`)
      .set('Cookie', `accessToken=${borrower.accessToken}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.request.status).toBe('CANCELLED');

    const [availableAgain] = await db.select().from(items).where(eq(items.id, itemId));
    expect(availableAgain.status).toBe('AVAILABLE');
  });

  it.each(['DECLINED', 'EXPIRED', 'CANCELLED', 'BORROWED', 'RETURNED', 'OVERDUE'] as const)(
    'rejects cancelling a request that is already %s',
    async (status) => {
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId });
      const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status });

      const res = await request(app)
        .patch(`/api/requests/${requestId}/cancel`)
        .set('Cookie', `accessToken=${borrower.accessToken}`);

      expect(res.status).toBe(409);
    },
  );

  it('cannot cancel another user\'s request', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/cancel`)
      .set('Cookie', `accessToken=${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it("the item owner (not the borrower) cannot cancel the request either", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/cancel`)
      .set('Cookie', `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown request id', async () => {
    const someone = await registerAndLogin();
    const res = await request(app)
      .patch('/api/requests/00000000-0000-0000-0000-000000000000/cancel')
      .set('Cookie', `accessToken=${someone.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId });

    const res = await request(app).patch(`/api/requests/${requestId}/cancel`);
    expect(res.status).toBe(401);
  });
});
