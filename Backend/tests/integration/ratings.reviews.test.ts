import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem, insertRating } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/users/:id/reviews', () => {
  it('returns only ratings where that user is the reviewee', async () => {
    const owner = await registerAndLogin();
    const otherUser = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    await insertRating({ borrowRequestId: requestId, reviewerId: borrower.userId, revieweeId: owner.userId, score: 5 });

    const ownerReviews = await request(app).get(`/api/users/${owner.userId}/reviews`);
    expect(ownerReviews.body.reviews).toHaveLength(1);

    const otherReviews = await request(app).get(`/api/users/${otherUser.userId}/reviews`);
    expect(otherReviews.body.reviews).toHaveLength(0);
  });

  it('works unauthenticated (public)', async () => {
    const owner = await registerAndLogin();
    const res = await request(app).get(`/api/users/${owner.userId}/reviews`);
    expect(res.status).toBe(200);
  });

  it('includes the reviewer name, score, comment, and date; excludes borrowRequestId', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });
    await insertRating({
      borrowRequestId: requestId,
      reviewerId: borrower.userId,
      revieweeId: owner.userId,
      score: 4,
      comment: 'Very reliable',
    });

    const res = await request(app).get(`/api/users/${owner.userId}/reviews`);

    const review = res.body.reviews[0];
    expect(review.reviewerId).toBe(borrower.userId);
    expect(review.reviewerName).toBe(borrower.payload.fullName);
    expect(review.score).toBe(4);
    expect(review.comment).toBe('Very reliable');
    expect(review.createdAt).toBeDefined();
    expect(review.borrowRequestId).toBeUndefined();
    expect('borrowRequestId' in review).toBe(false);
  });

  it('pagination works', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    for (let i = 0; i < 5; i += 1) {
      const borrower = await registerAndLogin();
      const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });
      await insertRating({ borrowRequestId: requestId, reviewerId: borrower.userId, revieweeId: owner.userId });
    }

    const page1 = await request(app).get(`/api/users/${owner.userId}/reviews`).query({ page: 1, limit: 2 });

    expect(page1.body.reviews).toHaveLength(2);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, totalItems: 5, totalPages: 3 });
  });

  it('a user with no ratings returns an empty array with 200, not an error', async () => {
    const owner = await registerAndLogin();
    const res = await request(app).get(`/api/users/${owner.userId}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.reviews).toEqual([]);
  });
});
