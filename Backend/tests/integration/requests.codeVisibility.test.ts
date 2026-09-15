import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/requests/:id code visibility', () => {
  it('as the borrower: sees pickup_code, and return_code is null before pickup is confirmed', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'ACCEPTED',
      pickupCode: '111222',
    });

    const res = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.body.request.pickupCode).toBe('111222');
    expect(res.body.request.returnCode).toBeNull();
  });

  it('as the borrower: still never sees return_code, even after pickup is confirmed', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      pickupCode: '111222',
      returnCode: '333444',
    });

    const res = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.body.request.pickupCode).toBe('111222');
    expect(res.body.request.returnCode).toBeNull();
  });

  it('as the owner: pickup_code is always null, and return_code is null before pickup, then visible after', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'ACCEPTED',
      pickupCode: '111222',
    });

    const beforePickup = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${owner.accessToken}`);
    expect(beforePickup.body.request.pickupCode).toBeNull();
    expect(beforePickup.body.request.returnCode).toBeNull();

    await request(app)
      .patch(`/api/requests/${requestId}/confirm-pickup`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ pickupCode: '111222' });

    const afterPickup = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${owner.accessToken}`);
    expect(afterPickup.body.request.pickupCode).toBeNull();
    expect(typeof afterPickup.body.request.returnCode).toBe('string');
  });
});

describe('GET /api/requests/mine code visibility', () => {
  it('always shows pickup_code and always nulls return_code, for every request', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      pickupCode: '111222',
      returnCode: '333444',
    });

    const res = await request(app).get('/api/requests/mine').set('Cookie', `accessToken=${borrower.accessToken}`);

    expect(res.body.requests[0].pickupCode).toBe('111222');
    expect(res.body.requests[0].returnCode).toBeNull();
  });
});

describe('GET /api/requests/incoming code visibility', () => {
  it('always shows return_code (once set) and always nulls pickup_code, for every request', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      pickupCode: '111222',
      returnCode: '333444',
    });

    const res = await request(app)
      .get('/api/requests/incoming')
      .query({ status: 'BORROWED' })
      .set('Cookie', `accessToken=${owner.accessToken}`);

    expect(res.body.requests[0].returnCode).toBe('333444');
    expect(res.body.requests[0].pickupCode).toBeNull();
  });
});
