import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function validRequestBody(itemId: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    itemId,
    pickupDate: futureDate(1),
    returnDate: futureDate(3),
    ...overrides,
  };
}

describe('POST /api/requests', () => {
  it('creates a PENDING request for an AVAILABLE item', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send(validRequestBody(itemId, { message: 'Need it for a lab report' }));

    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe('PENDING');
    expect(res.body.request.itemId).toBe(itemId);
    expect(res.body.request.borrowerId).toBe(borrower.userId);
    expect(res.body.request.message).toBe('Need it for a lab report');
    expect(res.body.request.expiresAt).toBeDefined();
  });

  it('cannot request your own item', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(validRequestBody(itemId));

    expect(res.status).toBe(403);
  });

  it.each(['PAUSED', 'RESERVED', 'BORROWED', 'OVERDUE', 'CANCELLED'] as const)(
    'rejects a request for an item that is %s, naming the actual status',
    async (status) => {
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId, status });

      const res = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${borrower.accessToken}`)
        .send(validRequestBody(itemId));

      expect(res.status).toBe(409);
      expect(res.body.error).toContain(status);
    },
  );

  it('rejects a duplicate PENDING request for the same item', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const first = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send(validRequestBody(itemId));
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send(validRequestBody(itemId));

    expect(second.status).toBe(409);
  });

  it('rejects a return date before the pickup date', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send(validRequestBody(itemId, { pickupDate: futureDate(5), returnDate: futureDate(2) }));

    expect(res.status).toBe(400);
    expect(res.body.fields.returnDate).toBeDefined();
  });

  it('rejects a pickup date in the past', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send(validRequestBody(itemId, { pickupDate: futureDate(-3) }));

    expect(res.status).toBe(400);
    expect(res.body.fields.pickupDate).toBeDefined();
  });

  it('returns 404 for a nonexistent item', async () => {
    const borrower = await registerAndLogin();

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send(validRequestBody('00000000-0000-0000-0000-000000000000'));

    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app).post('/api/requests').send(validRequestBody(itemId));
    expect(res.status).toBe(401);
  });
});
