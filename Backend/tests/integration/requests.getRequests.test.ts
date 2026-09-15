import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/requests/mine', () => {
  it('returns only the caller\'s own requests, across all statuses', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const otherBorrower = await registerAndLogin();
    const itemA = await insertItem({ ownerId: owner.userId, title: 'Item A' });
    const itemB = await insertItem({ ownerId: owner.userId, title: 'Item B' });

    await insertBorrowRequest({ itemId: itemA, borrowerId: borrower.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId: itemB, borrowerId: borrower.userId, status: 'CANCELLED' });
    await insertBorrowRequest({ itemId: itemA, borrowerId: otherBorrower.userId, status: 'PENDING' });

    const res = await request(app).get('/api/requests/mine').set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(2);
    expect(res.body.requests.every((r: { borrowerId: string }) => r.borrowerId === borrower.userId)).toBe(true);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/requests/mine');
    expect(res.status).toBe(401);
  });

  it('lazily expires a stale PENDING request when polled', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app).get('/api/requests/mine').set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.body.requests[0].status).toBe('EXPIRED');
  });
});

describe('GET /api/requests/:id', () => {
  it('lets the borrower view their own request', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId });

    const res = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.request.id).toBe(requestId);
  });

  it("lets the item's owner view the request", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId });

    const res = await request(app).get(`/api/requests/${requestId}`).set('Cookie', `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.request.id).toBe(requestId);
  });

  it('returns 404 for an unrelated user', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId });

    const res = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${stranger.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const someone = await registerAndLogin();
    const res = await request(app)
      .get('/api/requests/00000000-0000-0000-0000-000000000000')
      .set('Cookie', `accessToken=${someone.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId });

    const res = await request(app).get(`/api/requests/${requestId}`);
    expect(res.status).toBe(401);
  });

  it('lazily expires a stale PENDING request when polled by id', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.body.request.status).toBe('EXPIRED');
  });
});
