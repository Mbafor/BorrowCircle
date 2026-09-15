import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem, insertRating } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/ratings/my-pending', () => {
  it("returns a RETURNED request where the caller (borrower) hasn't rated yet", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, title: 'Lab Coat' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app)
      .get('/api/ratings/my-pending')
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pending).toHaveLength(1);
    expect(res.body.pending[0].borrowRequestId).toBe(requestId);
    expect(res.body.pending[0].itemTitle).toBe('Lab Coat');
    expect(res.body.pending[0].otherParticipantName).toBe(owner.payload.fullName);
  });

  it("returns a RETURNED request where the caller (owner) hasn't rated yet", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app).get('/api/ratings/my-pending').set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.body.pending).toHaveLength(1);
    expect(res.body.pending[0].otherParticipantName).toBe(borrower.payload.fullName);
  });

  it("excludes a RETURNED request where the caller already rated their side", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });
    await insertRating({ borrowRequestId: requestId, reviewerId: borrower.userId, revieweeId: owner.userId });

    const res = await request(app)
      .get('/api/ratings/my-pending')
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(res.body.pending).toHaveLength(0);
  });

  it("still shows it for the OTHER participant who hasn't rated yet", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });
    // Borrower already rated; owner hasn't.
    await insertRating({ borrowRequestId: requestId, reviewerId: borrower.userId, revieweeId: owner.userId });

    const res = await request(app).get('/api/ratings/my-pending').set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.body.pending).toHaveLength(1);
  });

  it.each(['PENDING', 'ACCEPTED', 'BORROWED', 'OVERDUE'] as const)('excludes requests that are %s, not RETURNED', async (status) => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status });

    const res = await request(app)
      .get('/api/ratings/my-pending')
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    expect(res.body.pending).toHaveLength(0);
  });

  it('excludes requests the caller is not a participant in', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const stranger = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'RETURNED' });

    const res = await request(app)
      .get('/api/ratings/my-pending')
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.body.pending).toHaveLength(0);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/ratings/my-pending');
    expect(res.status).toBe(401);
  });
});
