import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { borrowRequests, items } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('PATCH /api/requests/:id/confirm-pickup', () => {
  it('succeeds with the correct code: request and item become BORROWED, and return_code is generated', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'ACCEPTED',
      pickupCode: '111222',
    });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/confirm-pickup`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pickupCode: '111222' });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('BORROWED');
    expect(res.body.request.returnCode).toMatch(/^\d{6}$/);
    // Owner-facing response never reveals pickupCode, even for the code they just typed in.
    expect(res.body.request.pickupCode).toBeNull();

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item.status).toBe('BORROWED');

    const [row] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(row.returnCode).not.toBeNull();
  });

  it('rejects a wrong code with a generic error', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'ACCEPTED',
      pickupCode: '111222',
    });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/confirm-pickup`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pickupCode: '999999' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain('111222');

    const [row] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(row.status).toBe('ACCEPTED');
  });

  it('rejects a non-owner', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'ACCEPTED',
      pickupCode: '111222',
    });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/confirm-pickup`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ pickupCode: '111222' });

    expect(res.status).toBe(403);
  });

  it.each(['PENDING', 'BORROWED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'RETURNED', 'OVERDUE'] as const)(
    'rejects confirming pickup when the request is %s, naming the actual status',
    async (status) => {
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId });
      const requestId = await insertBorrowRequest({
        itemId,
        borrowerId: borrower.userId,
        status,
        pickupCode: '111222',
      });

      const res = await request(app)
        .patch(`/api/requests/${requestId}/confirm-pickup`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ pickupCode: '111222' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(status);
    },
  );

  it('rejects a malformed code with 400', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'ACCEPTED' });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/confirm-pickup`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pickupCode: 'abc' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown request id', async () => {
    const owner = await registerAndLogin();
    const res = await request(app)
      .patch('/api/requests/00000000-0000-0000-0000-000000000000/confirm-pickup')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pickupCode: '111222' });
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'ACCEPTED' });

    const res = await request(app).patch(`/api/requests/${requestId}/confirm-pickup`).send({ pickupCode: '111222' });
    expect(res.status).toBe(401);
  });
});
