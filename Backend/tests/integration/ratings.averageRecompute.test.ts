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

describe('average rating recompute', () => {
  it("updates the reviewee's average_rating correctly after one rating", async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const itemA = await insertItem({ ownerId: owner.userId });
    const requestA = await insertBorrowRequest({ itemId: itemA, borrowerId: borrowerA.userId, status: 'RETURNED' });

    await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrowerA.accessToken}`)
      .send({ borrowRequestId: requestA, score: 5 });

    const [row] = await db.select().from(users).where(eq(users.id, owner.userId));
    expect(row.averageRating).toBe('5.00');
  });

  // Proves the recompute is a true aggregate, not incremental or
  // "last value wins": two ratings of 5 and 2 average to 3.5 — a
  // last-value-wins implementation would show 2.0, a naive incremental
  // implementation could drift to something else entirely.
  it('recomputes as a true average across two separate completed agreements, not the latest score', async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const borrowerB = await registerAndLogin();
    const itemA = await insertItem({ ownerId: owner.userId, title: 'Item A' });
    const itemB = await insertItem({ ownerId: owner.userId, title: 'Item B' });
    const requestA = await insertBorrowRequest({ itemId: itemA, borrowerId: borrowerA.userId, status: 'RETURNED' });
    const requestB = await insertBorrowRequest({ itemId: itemB, borrowerId: borrowerB.userId, status: 'RETURNED' });

    await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrowerA.accessToken}`)
      .send({ borrowRequestId: requestA, score: 5 });

    const [afterFirst] = await db.select().from(users).where(eq(users.id, owner.userId));
    expect(afterFirst.averageRating).toBe('5.00');

    await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrowerB.accessToken}`)
      .send({ borrowRequestId: requestB, score: 2 });

    const [afterSecond] = await db.select().from(users).where(eq(users.id, owner.userId));
    expect(afterSecond.averageRating).toBe('3.50');
  });
});
