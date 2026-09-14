import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/requests/incoming', () => {
  it('returns only requests on items the caller owns', async () => {
    const ownerA = await registerAndLogin();
    const ownerB = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemA = await insertItem({ ownerId: ownerA.userId });
    const itemB = await insertItem({ ownerId: ownerB.userId });
    await insertBorrowRequest({ itemId: itemA, borrowerId: borrower.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId: itemB, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app).get('/api/requests/incoming').set('Authorization', `Bearer ${ownerA.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].itemId).toBe(itemA);
  });

  it('defaults to PENDING when no status filter is given', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'DECLINED' });

    const res = await request(app).get('/api/requests/incoming').set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].status).toBe('PENDING');
  });

  it('respects an explicit status filter', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'DECLINED' });

    const res = await request(app)
      .get('/api/requests/incoming')
      .query({ status: 'DECLINED' })
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].status).toBe('DECLINED');
  });

  it('rejects an invalid status value with 400', async () => {
    const owner = await registerAndLogin();
    const res = await request(app)
      .get('/api/requests/incoming')
      .query({ status: 'NOT_A_STATUS' })
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(400);
  });

  it('narrows correctly with an itemId filter', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemA = await insertItem({ ownerId: owner.userId, title: 'A' });
    const itemB = await insertItem({ ownerId: owner.userId, title: 'B' });
    await insertBorrowRequest({ itemId: itemA, borrowerId: borrower.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId: itemB, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .get('/api/requests/incoming')
      .query({ itemId: itemA })
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].itemId).toBe(itemA);
  });

  it('returns an empty list, not an error, for an itemId owned by someone else', async () => {
    const owner = await registerAndLogin();
    const otherOwner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const otherItem = await insertItem({ ownerId: otherOwner.userId });
    await insertBorrowRequest({ itemId: otherItem, borrowerId: borrower.userId, status: 'PENDING' });

    const res = await request(app)
      .get('/api/requests/incoming')
      .query({ itemId: otherItem })
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.requests).toEqual([]);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/requests/incoming');
    expect(res.status).toBe(401);
  });
});
