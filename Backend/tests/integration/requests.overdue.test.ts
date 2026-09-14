import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { borrowRequests, items } from '../../src/db/schema';
import { flagOverdueRequests } from '../../src/services/requests.service';

beforeEach(async () => {
  await clearDatabase();
});

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

describe('flagOverdueRequests', () => {
  it('flags a BORROWED request past its return_date as OVERDUE, along with its item', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(-2),
    });

    const count = await flagOverdueRequests();

    expect(count).toBe(1);
    const [reqRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    const [itemRow] = await db.select().from(items).where(eq(items.id, itemId));
    expect(reqRow.status).toBe('OVERDUE');
    expect(itemRow.status).toBe('OVERDUE');
  });

  it('leaves a BORROWED request not yet past its return_date untouched', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(5),
    });

    await flagOverdueRequests();

    const [reqRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(reqRow.status).toBe('BORROWED');
  });

  it('is idempotent: running it twice does not error or double-process', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(-2),
    });

    const first = await flagOverdueRequests();
    const second = await flagOverdueRequests();

    expect(first).toBe(1);
    expect(second).toBe(0);
  });

  it('never touches an already-RETURNED request, even with a past return_date', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'RETURNED',
      returnDate: daysFromToday(-10),
    });

    await flagOverdueRequests();

    const [reqRow] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(reqRow.status).toBe('RETURNED');
  });
});

describe('lazy overdue check on GET endpoints', () => {
  it('GET /api/requests/:id shows OVERDUE even before the cron has run', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(-2),
    });

    const res = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(res.body.request.status).toBe('OVERDUE');
  });

  it('GET /api/requests/mine shows OVERDUE even before the cron has run', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(-2),
    });

    const res = await request(app).get('/api/requests/mine').set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(res.body.requests[0].status).toBe('OVERDUE');
  });
});
