import request from '../setup/request';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { users } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/dashboard/summary', () => {
  it('activeBorrows counts only BORROWED/OVERDUE requests where the caller is the borrower', async () => {
    const owner = await registerAndLogin();
    const me = await registerAndLogin();
    const itemA = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const itemB = await insertItem({ ownerId: owner.userId, status: 'OVERDUE' });
    const itemC = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    await insertBorrowRequest({ itemId: itemA, borrowerId: me.userId, status: 'BORROWED' });
    await insertBorrowRequest({ itemId: itemB, borrowerId: me.userId, status: 'OVERDUE' });
    // PENDING should not count as an active borrow.
    await insertBorrowRequest({ itemId: itemC, borrowerId: me.userId, status: 'PENDING' });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', `accessToken=${me.accessToken}`);

    expect(res.body.activeBorrows).toBe(2);
  });

  it('activeBorrows does not count a BORROWED request where the caller is the owner, not the borrower', async () => {
    const me = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: me.userId, status: 'BORROWED' });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'BORROWED' });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', `accessToken=${me.accessToken}`);

    expect(res.body.activeBorrows).toBe(0);
  });

  it('itemsListed excludes CANCELLED items but includes PAUSED ones', async () => {
    const me = await registerAndLogin();
    await insertItem({ ownerId: me.userId, status: 'AVAILABLE' });
    await insertItem({ ownerId: me.userId, status: 'PAUSED' });
    await insertItem({ ownerId: me.userId, status: 'CANCELLED' });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', `accessToken=${me.accessToken}`);

    expect(res.body.itemsListed).toBe(2);
  });

  it('pendingRequestsToReview counts only incoming requests, not the caller\'s own outgoing pending request', async () => {
    const me = await registerAndLogin();
    const someoneElse = await registerAndLogin();

    // me as lender: one incoming PENDING request to review.
    const myItem = await insertItem({ ownerId: me.userId, status: 'AVAILABLE' });
    await insertBorrowRequest({ itemId: myItem, borrowerId: someoneElse.userId, status: 'PENDING' });

    // me as borrower: one outgoing PENDING request on someone else's item — must NOT count.
    const theirItem = await insertItem({ ownerId: someoneElse.userId, status: 'AVAILABLE' });
    await insertBorrowRequest({ itemId: theirItem, borrowerId: me.userId, status: 'PENDING' });

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', `accessToken=${me.accessToken}`);

    expect(res.body.pendingRequestsToReview).toBe(1);
  });

  it('averageRating matches the stored users.average_rating value exactly', async () => {
    const me = await registerAndLogin();
    await db.update(users).set({ averageRating: '4.50' }).where(eq(users.id, me.userId));

    const res = await request(app).get('/api/dashboard/summary').set('Cookie', `accessToken=${me.accessToken}`);

    expect(res.body.averageRating).toBe('4.50');
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });
});
