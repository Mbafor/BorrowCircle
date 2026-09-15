import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('dashboard isolation between users', () => {
  it("neither user's dashboard endpoints ever return data belonging to the other", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();

    // Each user owns an item and has sent a request on the other's item.
    const itemA = await insertItem({ ownerId: userA.userId, title: "A's item" });
    const itemB = await insertItem({ ownerId: userB.userId, title: "B's item" });
    await insertBorrowRequest({ itemId: itemB, borrowerId: userA.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId: itemA, borrowerId: userB.userId, status: 'PENDING' });

    const [lendingA, lendingB, borrowingA, borrowingB, summaryA, summaryB] = await Promise.all([
      request(app).get('/api/dashboard/lending').set('Cookie', `accessToken=${userA.accessToken}`),
      request(app).get('/api/dashboard/lending').set('Cookie', `accessToken=${userB.accessToken}`),
      request(app).get('/api/dashboard/borrowing').set('Cookie', `accessToken=${userA.accessToken}`),
      request(app).get('/api/dashboard/borrowing').set('Cookie', `accessToken=${userB.accessToken}`),
      request(app).get('/api/dashboard/summary').set('Cookie', `accessToken=${userA.accessToken}`),
      request(app).get('/api/dashboard/summary').set('Cookie', `accessToken=${userB.accessToken}`),
    ]);

    expect(lendingA.body.items).toHaveLength(1);
    expect(lendingA.body.items[0].title).toBe("A's item");
    expect(lendingB.body.items).toHaveLength(1);
    expect(lendingB.body.items[0].title).toBe("B's item");

    expect(borrowingA.body.requests).toHaveLength(1);
    expect(borrowingA.body.requests[0].itemTitle).toBe("B's item");
    expect(borrowingB.body.requests).toHaveLength(1);
    expect(borrowingB.body.requests[0].itemTitle).toBe("A's item");

    expect(summaryA.body.itemsListed).toBe(1);
    expect(summaryA.body.pendingRequestsToReview).toBe(1);
    expect(summaryB.body.itemsListed).toBe(1);
    expect(summaryB.body.pendingRequestsToReview).toBe(1);
  });
});
