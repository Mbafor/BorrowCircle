import request from '../setup/request';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem, insertRating } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { users } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/ratings', () => {
  it('succeeds when the borrower rates the owner', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 5, comment: 'Great lender!' });

    expect(res.status).toBe(201);
    expect(res.body.rating.reviewerId).toBe(borrower.userId);
    expect(res.body.rating.revieweeId).toBe(owner.userId);
    expect(res.body.rating.score).toBe(5);
  });

  it('succeeds when the owner rates the borrower on the same completed request (both directions independently)', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const borrowerRates = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 5 });
    expect(borrowerRates.status).toBe(201);

    const ownerRates = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ borrowRequestId: requestId, score: 4 });
    expect(ownerRates.status).toBe(201);
    expect(ownerRates.body.rating.reviewerId).toBe(owner.userId);
    expect(ownerRates.body.rating.revieweeId).toBe(borrower.userId);
  });

  it.each(['PENDING', 'ACCEPTED', 'BORROWED', 'OVERDUE', 'DECLINED', 'CANCELLED', 'EXPIRED'] as const)(
    'rejects rating a request that is %s, naming the actual status',
    async (status) => {
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId });
      const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status });

      const res = await request(app)
        .post('/api/ratings')
        .set('Cookie', `accessToken=${borrower.accessToken}`)
        .send({ borrowRequestId: requestId, score: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(status);
    },
  );

  it('rejects a caller who is not a participant in the request', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${stranger.accessToken}`)
      .send({ borrowRequestId: requestId, score: 5 });

    expect(res.status).toBe(403);
  });

  it('rejects a duplicate rating attempt in the same direction', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });
    await insertRating({ borrowRequestId: requestId, reviewerId: borrower.userId, revieweeId: owner.userId });

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 3 });

    expect(res.status).toBe(409);
  });

  it('rejects a score of 0', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 0 });

    expect(res.status).toBe(400);
  });

  it('rejects a score of 6', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 6 });

    expect(res.status).toBe(400);
  });

  it('rejects a non-integer score', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 3.5 });

    expect(res.status).toBe(400);
  });

  it('rejects a comment over 500 characters', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 5, comment: 'a'.repeat(501) });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown borrowRequestId', async () => {
    const borrower = await registerAndLogin();
    const res = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: '00000000-0000-0000-0000-000000000000', score: 5 });
    expect(res.status).toBe(404);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app).post('/api/ratings').send({ borrowRequestId: requestId, score: 5 });
    expect(res.status).toBe(401);
  });

  it("updates the reviewee's average_rating after the rating is created", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${borrower.accessToken}`)
      .send({ borrowRequestId: requestId, score: 4 });

    const [ownerRow] = await db.select().from(users).where(eq(users.id, owner.userId));
    expect(ownerRow.averageRating).toBe('4.00');
  });
});
