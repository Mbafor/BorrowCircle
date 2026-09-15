import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/dashboard/borrowing', () => {
  it("returns only the caller's own sent requests", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const otherBorrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId, borrowerId: otherBorrower.userId, status: 'PENDING' });

    const res = await request(app)
      .get('/api/dashboard/borrowing')
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
  });

  it('returns requests across all statuses, most recent first by default', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, title: 'The Item' });

    const older = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'CANCELLED' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const newer = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'DECLINED' });

    const res = await request(app)
      .get('/api/dashboard/borrowing')
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(res.body.requests.map((r: { id: string }) => r.id)).toEqual([newer, older]);
    expect(res.body.requests[0].itemTitle).toBe('The Item');
    expect(res.body.requests[0].lenderId).toBe(owner.userId);
    expect(res.body.requests[0].lenderName).toBe(owner.payload.fullName);
  });

  it('includes cancelled/expired/declined requests, not just active ones', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'CANCELLED' });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'EXPIRED' });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'DECLINED' });

    const res = await request(app)
      .get('/api/dashboard/borrowing')
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    const statuses = res.body.requests.map((r: { status: string }) => r.status).sort();
    expect(statuses).toEqual(['CANCELLED', 'DECLINED', 'EXPIRED']);
  });

  it('status filter narrows correctly', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'DECLINED' });

    const res = await request(app)
      .get('/api/dashboard/borrowing')
      .query({ status: 'DECLINED' })
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].status).toBe('DECLINED');
  });

  it('rejects an invalid status filter with 400', async () => {
    const borrower = await registerAndLogin();
    const res = await request(app)
      .get('/api/dashboard/borrowing')
      .query({ status: 'NOT_A_STATUS' })
      .set('Authorization', `Bearer ${borrower.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('pagination works', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    for (let i = 0; i < 5; i += 1) {
      await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'CANCELLED' });
    }

    const page1 = await request(app)
      .get('/api/dashboard/borrowing')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(page1.body.requests).toHaveLength(2);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, totalItems: 5, totalPages: 3 });
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/dashboard/borrowing');
    expect(res.status).toBe(401);
  });
});
