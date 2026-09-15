import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/dashboard/lending', () => {
  it("returns only the caller's own items", async () => {
    const owner = await registerAndLogin();
    const otherOwner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, title: 'Mine' });
    await insertItem({ ownerId: otherOwner.userId, title: 'Not mine' });

    const res = await request(app).get('/api/dashboard/lending').set('Cookie', `accessToken=${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Mine');
  });

  it('shows null activeRequest and zero pendingRequestCount for an item with no requests', async () => {
    const owner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId });

    const res = await request(app).get('/api/dashboard/lending').set('Cookie', `accessToken=${owner.accessToken}`);

    expect(res.body.items[0].activeRequest).toBeNull();
    expect(res.body.items[0].pendingRequestCount).toBe(0);
  });

  it('embeds a single PENDING request correctly', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app).get('/api/dashboard/lending').set('Cookie', `accessToken=${owner.accessToken}`);

    const item = res.body.items[0];
    expect(item.activeRequest).not.toBeNull();
    expect(item.activeRequest.status).toBe('PENDING');
    expect(item.activeRequest.borrowerId).toBe(borrower.userId);
    expect(item.activeRequest.borrowerName).toBe(borrower.payload.fullName);
    expect(item.pendingRequestCount).toBe(1);
  });

  it('with multiple PENDING requests, embeds the most recent and reports the correct pendingRequestCount', async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const borrowerB = await registerAndLogin();
    const borrowerC = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    await insertBorrowRequest({
      itemId,
      borrowerId: borrowerA.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 1000),
    });
    // Small delay so createdAt ordering is unambiguous across inserts.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await insertBorrowRequest({
      itemId,
      borrowerId: borrowerB.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 2000),
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const mostRecent = await insertBorrowRequest({
      itemId,
      borrowerId: borrowerC.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 3000),
    });

    const res = await request(app).get('/api/dashboard/lending').set('Cookie', `accessToken=${owner.accessToken}`);

    const item = res.body.items[0];
    expect(item.activeRequest.id).toBe(mostRecent);
    expect(item.activeRequest.borrowerId).toBe(borrowerC.userId);
    expect(item.pendingRequestCount).toBe(3);
  });

  it('embeds an ACCEPTED/BORROWED/OVERDUE request when present', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'BORROWED' });

    const res = await request(app).get('/api/dashboard/lending').set('Cookie', `accessToken=${owner.accessToken}`);

    const item = res.body.items[0];
    expect(item.activeRequest.id).toBe(requestId);
    expect(item.activeRequest.status).toBe('BORROWED');
    expect(item.pendingRequestCount).toBe(0);
  });

  it('status filter narrows correctly', async () => {
    const owner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', title: 'Available One' });
    await insertItem({ ownerId: owner.userId, status: 'PAUSED', title: 'Paused One' });

    const res = await request(app)
      .get('/api/dashboard/lending')
      .query({ status: 'PAUSED' })
      .set('Cookie', `accessToken=${owner.accessToken}`);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Paused One');
  });

  it('rejects an invalid status filter with 400', async () => {
    const owner = await registerAndLogin();
    const res = await request(app)
      .get('/api/dashboard/lending')
      .query({ status: 'NOT_A_STATUS' })
      .set('Cookie', `accessToken=${owner.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('pagination works the same way it does in browse', async () => {
    const owner = await registerAndLogin();
    for (let i = 0; i < 5; i += 1) {
      await insertItem({ ownerId: owner.userId, title: `Item ${i}` });
    }

    const page1 = await request(app)
      .get('/api/dashboard/lending')
      .query({ page: 1, limit: 2 })
      .set('Cookie', `accessToken=${owner.accessToken}`);
    const page2 = await request(app)
      .get('/api/dashboard/lending')
      .query({ page: 2, limit: 2 })
      .set('Cookie', `accessToken=${owner.accessToken}`);

    expect(page1.body.items).toHaveLength(2);
    expect(page2.body.items).toHaveLength(2);
    const page1Ids = page1.body.items.map((i: { id: string }) => i.id);
    const page2Ids = page2.body.items.map((i: { id: string }) => i.id);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, totalItems: 5, totalPages: 3 });
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/dashboard/lending');
    expect(res.status).toBe(401);
  });
});
