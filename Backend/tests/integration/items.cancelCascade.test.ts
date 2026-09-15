import request from '../setup/request';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { borrowRequests, items } from '../../src/db/schema';
import { cancelPendingRequestsForItem } from '../../src/services/requests.service';

beforeEach(async () => {
  await clearDatabase();
});

// "Unit"-style: calls the cascade function directly (in isolation from the
// item-status-change flow that wires it in), rather than through HTTP.
describe('cancelPendingRequestsForItem (direct call)', () => {
  it('cancels every PENDING request for the item and returns the count', async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const borrowerB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const reqA = await insertBorrowRequest({ itemId, borrowerId: borrowerA.userId, status: 'PENDING' });
    const reqB = await insertBorrowRequest({ itemId, borrowerId: borrowerB.userId, status: 'PENDING' });

    const count = await db.transaction((tx) => cancelPendingRequestsForItem(tx, itemId, 'Scientific Calculator'));

    expect(count).toBe(2);
    const [rowA] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, reqA));
    const [rowB] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, reqB));
    expect(rowA.status).toBe('CANCELLED');
    expect(rowB.status).toBe('CANCELLED');
  });

  it('does not touch requests on other items', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemA = await insertItem({ ownerId: owner.userId, title: 'A' });
    const itemB = await insertItem({ ownerId: owner.userId, title: 'B' });
    const reqOnA = await insertBorrowRequest({ itemId: itemA, borrowerId: borrower.userId, status: 'PENDING' });
    const reqOnB = await insertBorrowRequest({ itemId: itemB, borrowerId: borrower.userId, status: 'PENDING' });

    await db.transaction((tx) => cancelPendingRequestsForItem(tx, itemA, 'A'));

    const [rowA] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, reqOnA));
    const [rowB] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, reqOnB));
    expect(rowA.status).toBe('CANCELLED');
    expect(rowB.status).toBe('PENDING');
  });

  it('does not touch non-PENDING requests on the same item', async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const borrowerB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const pending = await insertBorrowRequest({ itemId, borrowerId: borrowerA.userId, status: 'PENDING' });
    const declined = await insertBorrowRequest({ itemId, borrowerId: borrowerB.userId, status: 'DECLINED' });

    await db.transaction((tx) => cancelPendingRequestsForItem(tx, itemId, 'Scientific Calculator'));

    const [pendingRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, pending));
    const [declinedRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, declined));
    expect(pendingRow.status).toBe('CANCELLED');
    expect(declinedRow.status).toBe('DECLINED');
  });

  it('returns 0 and errors on nothing when there are no requests at all', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const count = await db.transaction((tx) => cancelPendingRequestsForItem(tx, itemId, 'Scientific Calculator'));

    expect(count).toBe(0);
  });
});

describe('PATCH /api/items/:id/status — cancellation cascade', () => {
  it('cancelling an AVAILABLE item with one PENDING request cancels both together', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CANCELLED');

    const [reqRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(reqRow.status).toBe('CANCELLED');
  });

  it('cancelling an AVAILABLE item with multiple PENDING requests from different borrowers cancels all of them', async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const borrowerB = await registerAndLogin();
    const borrowerC = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const reqA = await insertBorrowRequest({ itemId, borrowerId: borrowerA.userId, status: 'PENDING' });
    const reqB = await insertBorrowRequest({ itemId, borrowerId: borrowerB.userId, status: 'PENDING' });
    const reqC = await insertBorrowRequest({ itemId, borrowerId: borrowerC.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);

    const rows = await db.select().from(borrowRequests).where(eq(borrowRequests.itemId, itemId));
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(reqA)?.status).toBe('CANCELLED');
    expect(byId.get(reqB)?.status).toBe('CANCELLED');
    expect(byId.get(reqC)?.status).toBe('CANCELLED');
  });

  it('cancelling a PAUSED item with a PENDING request applies the same cascade', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'PAUSED' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CANCELLED');

    const [reqRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(reqRow.status).toBe('CANCELLED');
  });

  it('pausing an item with a PENDING request leaves the request untouched (still PENDING)', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ status: 'PAUSED' });
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('PAUSED');

    const [reqRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(reqRow.status).toBe('PENDING');
  });

  it('cancelling an item with zero requests succeeds with no error', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CANCELLED');
  });

  // Regression: proves the invariant from the investigation above holds
  // end-to-end — an item with an ACCEPTED request is RESERVED, and Feature
  // 3's existing gating already blocks cancelling a RESERVED item, so the
  // ACCEPTED request is never reachable by this cascade.
  it('regression: cannot cancel a RESERVED item (with an ACCEPTED request), and that request is untouched', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'ACCEPTED' });

    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(409);

    const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
    const [reqRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(itemRow.status).toBe('RESERVED');
    expect(reqRow.status).toBe('ACCEPTED');
  });

  it('a non-owner cannot trigger the cascade by cancelling another user\'s item', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Cookie', `accessToken=${stranger.accessToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(403);

    const [reqRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(reqRow.status).toBe('PENDING');
  });
});
