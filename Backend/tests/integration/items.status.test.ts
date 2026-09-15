import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

async function patchStatus(itemId: string, accessToken: string, status: string) {
  return request(app)
    .patch(`/api/items/${itemId}/status`)
    .set('Cookie', `accessToken=${accessToken}`)
    .send({ status });
}

describe('PATCH /api/items/:id/status', () => {
  it('AVAILABLE -> PAUSED succeeds', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await patchStatus(itemId, owner.accessToken, 'PAUSED');
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('PAUSED');
  });

  it('PAUSED -> AVAILABLE succeeds', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'PAUSED' });

    const res = await patchStatus(itemId, owner.accessToken, 'AVAILABLE');
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('AVAILABLE');
  });

  it('AVAILABLE -> CANCELLED succeeds', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await patchStatus(itemId, owner.accessToken, 'CANCELLED');
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CANCELLED');
  });

  it('PAUSED -> CANCELLED succeeds', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'PAUSED' });

    const res = await patchStatus(itemId, owner.accessToken, 'CANCELLED');
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CANCELLED');
  });

  it('CANCELLED -> AVAILABLE is rejected (terminal state)', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'CANCELLED' });

    const res = await patchStatus(itemId, owner.accessToken, 'AVAILABLE');
    expect(res.status).toBe(409);
  });

  it.each(['RESERVED', 'BORROWED', 'OVERDUE'] as const)(
    'pausing or cancelling a %s item is rejected with a clear error',
    async (status) => {
      const owner = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId, status });

      const pauseRes = await patchStatus(itemId, owner.accessToken, 'PAUSED');
      expect(pauseRes.status).toBe(409);
      expect(pauseRes.body.error).toBeDefined();

      const cancelRes = await patchStatus(itemId, owner.accessToken, 'CANCELLED');
      expect(cancelRes.status).toBe(409);
    },
  );

  it('rejects a status value not settable through this endpoint', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await patchStatus(itemId, owner.accessToken, 'RESERVED');
    expect(res.status).toBe(400);
  });

  it('a non-owner cannot change another user\'s item status', async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await patchStatus(itemId, other.accessToken, 'PAUSED');
    expect(res.status).toBe(403);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app).patch(`/api/items/${itemId}/status`).send({ status: 'PAUSED' });
    expect(res.status).toBe(401);
  });
});
