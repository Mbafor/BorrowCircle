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

describe('PATCH /api/requests/:id/confirm-return', () => {
  it('succeeds with the correct code from BORROWED: request becomes RETURNED, item becomes AVAILABLE', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnCode: '333444',
    });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/confirm-return`)
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ returnCode: '333444' });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('RETURNED');
    // Borrower-facing response never reveals returnCode.
    expect(res.body.request.returnCode).toBeNull();

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item.status).toBe('AVAILABLE');
  });

  it('also succeeds from OVERDUE', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'OVERDUE' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'OVERDUE',
      returnCode: '333444',
    });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/confirm-return`)
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ returnCode: '333444' });

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('RETURNED');

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item.status).toBe('AVAILABLE');
  });

  it('rejects a wrong code with a generic error', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnCode: '333444',
    });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/confirm-return`)
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ returnCode: '000000' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('333444');
  });

  it('rejects a non-borrower (e.g. the item owner)', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnCode: '333444',
    });

    const res = await request(app)
      .patch(`/api/requests/${requestId}/confirm-return`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ returnCode: '333444' });

    expect(res.status).toBe(403);
  });

  it.each(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'RETURNED'] as const)(
    'rejects confirming return when the request is %s, naming the actual status',
    async (status) => {
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId });
      const requestId = await insertBorrowRequest({
        itemId,
        borrowerId: borrower.userId,
        status,
        returnCode: '333444',
      });

      const res = await request(app)
        .patch(`/api/requests/${requestId}/confirm-return`)
        .set('Cookie', `accessToken=${borrower.accessToken}`)
        .send({ returnCode: '333444' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(status);
    },
  );

  it('returns 404 for an unknown request id', async () => {
    const borrower = await registerAndLogin();
    const res = await request(app)
      .patch('/api/requests/00000000-0000-0000-0000-000000000000/confirm-return')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ returnCode: '333444' });
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'BORROWED' });

    const res = await request(app).patch(`/api/requests/${requestId}/confirm-return`).send({ returnCode: '333444' });
    expect(res.status).toBe(401);
  });
});
