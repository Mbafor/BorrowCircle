import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/items/:id', () => {
  it('lets the owner see full details at any status, including PAUSED', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'PAUSED' });

    const res = await request(app).get(`/api/items/${itemId}`).set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('PAUSED');
  });

  it('lets the owner see a CANCELLED item', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'CANCELLED' });

    const res = await request(app).get(`/api/items/${itemId}`).set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CANCELLED');
  });

  it.each(['AVAILABLE', 'RESERVED', 'BORROWED', 'OVERDUE'] as const)(
    'lets a non-owner (and anonymous requests) see a %s item',
    async (status) => {
      const owner = await registerAndLogin();
      const other = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId, status });

      const asOther = await request(app).get(`/api/items/${itemId}`).set('Authorization', `Bearer ${other.accessToken}`);
      expect(asOther.status).toBe(200);

      const anonymous = await request(app).get(`/api/items/${itemId}`);
      expect(anonymous.status).toBe(200);
    },
  );

  it.each(['PAUSED', 'CANCELLED'] as const)('returns 404 for a %s item to a non-owner', async (status) => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status });

    const asOther = await request(app).get(`/api/items/${itemId}`).set('Authorization', `Bearer ${other.accessToken}`);
    expect(asOther.status).toBe(404);

    const anonymous = await request(app).get(`/api/items/${itemId}`);
    expect(anonymous.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/items/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/items/mine', () => {
  it("returns only the caller's own items across all statuses", async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', title: 'Mine 1' });
    await insertItem({ ownerId: owner.userId, status: 'PAUSED', title: 'Mine 2' });
    await insertItem({ ownerId: other.userId, status: 'AVAILABLE', title: 'Not mine' });

    const res = await request(app).get('/api/items/mine').set('Authorization', `Bearer ${owner.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((item: { title: string }) => item.title).sort()).toEqual(['Mine 1', 'Mine 2']);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/items/mine');
    expect(res.status).toBe(401);
  });
});
