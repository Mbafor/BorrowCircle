import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { borrowRequests, items } from '../../src/db/schema';
import { AUTO_DECLINE_REASON } from '../../src/services/requests.service';

beforeEach(async () => {
  await clearDatabase();
});

describe('PATCH /api/requests/:id/accept', () => {
  it('accepts a PENDING request: the request becomes ACCEPTED and the item becomes RESERVED', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/accept`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('ACCEPTED');

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item.status).toBe('RESERVED');
  });

  it('auto-declines every other PENDING request on the same item, with the system reason', async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const borrowerB = await registerAndLogin();
    const borrowerC = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestA = await insertBorrowRequest({ itemId, borrowerId: borrowerA.userId, status: 'PENDING' });
    const requestB = await insertBorrowRequest({ itemId, borrowerId: borrowerB.userId, status: 'PENDING' });
    const requestC = await insertBorrowRequest({ itemId, borrowerId: borrowerC.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestA}/accept`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(200);

    const [bRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestB));
    const [cRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestC));
    expect(bRow.status).toBe('DECLINED');
    expect(bRow.declineReason).toBe(AUTO_DECLINE_REASON);
    expect(cRow.status).toBe('DECLINED');
    expect(cRow.declineReason).toBe(AUTO_DECLINE_REASON);
  });

  it('a non-owner cannot accept', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/accept`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it.each(['ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED'] as const)(
    'rejects accepting a request that is already %s, naming the actual status',
    async (status) => {
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId });
      const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status });

      const res = await request(app)
        .patch(`/api/requests/${requestId}/accept`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(status);
    },
  );

  it('returns 404 for an unknown request id', async () => {
    const owner = await registerAndLogin();
    const res = await request(app)
      .patch('/api/requests/00000000-0000-0000-0000-000000000000/accept')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId });

    const res = await request(app).patch(`/api/requests/${requestId}/accept`);
    expect(res.status).toBe(401);
  });

  // The concurrency requirement: two accept calls racing on different PENDING
  // requests for the same item. Our implementation locks the item row
  // (SELECT ... FOR UPDATE) inside the accept transaction, so the loser
  // blocks until the winner commits, then sees the item is no longer
  // AVAILABLE and fails with a 409 — meanwhile its own request has already
  // been auto-declined by the winner's cascade. So the documented outcome
  // is: exactly one 200 (ACCEPTED), one 409 (from the loser's own call), the
  // item ends up RESERVED exactly once, and the losing request ends up
  // DECLINED (via cascade, not via the loser's own failed call).
  it('under concurrent accept attempts on different requests for the same item, exactly one succeeds', async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const borrowerB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestA = await insertBorrowRequest({ itemId, borrowerId: borrowerA.userId, status: 'PENDING' });
    const requestB = await insertBorrowRequest({ itemId, borrowerId: borrowerB.userId, status: 'PENDING' });

    const [resA, resB] = await Promise.all([
      request(app).patch(`/api/requests/${requestA}/accept`).set('Authorization', `Bearer ${owner.accessToken}`),
      request(app).patch(`/api/requests/${requestB}/accept`).set('Authorization', `Bearer ${owner.accessToken}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item.status).toBe('RESERVED');

    const allRequests = await db
      .select()
      .from(borrowRequests)
      .where(eq(borrowRequests.itemId, itemId));
    const acceptedCount = allRequests.filter((r) => r.status === 'ACCEPTED').length;
    const declinedCount = allRequests.filter((r) => r.status === 'DECLINED').length;
    expect(acceptedCount).toBe(1);
    expect(declinedCount).toBe(1);
  });
});
