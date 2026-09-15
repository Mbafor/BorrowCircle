import request from '../setup/request';
import { and, eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { notifications } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('rating notification', () => {
  it('creates a RATING_RECEIVED notification for the reviewee with the correct target', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 5 });

    const ownerNotifications = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, owner.userId), eq(notifications.type, 'RATING_RECEIVED')));

    expect(ownerNotifications).toHaveLength(1);
    expect(ownerNotifications[0].targetType).toBe('BORROW_REQUEST');
    expect(ownerNotifications[0].targetId).toBe(requestId);
  });

  it('does not notify the reviewer, only the reviewee', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 5 });

    const reviewerNotifications = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, borrower.userId), eq(notifications.type, 'RATING_RECEIVED')));

    expect(reviewerNotifications).toHaveLength(0);
  });
});

describe('cross-check with Feature 9 dashboard summary', () => {
  it("averageRating on the dashboard summary reflects the rating just submitted", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const before = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `accessToken=${owner.accessToken}`);
    expect(before.body.averageRating).toBe('0.00');

    await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 4 });

    const after = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `accessToken=${owner.accessToken}`);
    expect(after.body.averageRating).toBe('4.00');
  });
});
