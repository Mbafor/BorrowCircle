import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('PATCH /api/items/:id', () => {
  it.each(['AVAILABLE', 'PAUSED'] as const)('succeeds while the item is %s', async (status) => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status });

    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.item.title).toBe('Updated Title');
  });

  it.each(['RESERVED', 'BORROWED', 'OVERDUE', 'CANCELLED'] as const)('is rejected while the item is %s', async (status) => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status });

    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Nope' });

    expect(res.status).toBe(409);
  });

  it('rejects updating the price on a FREE item', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', borrowType: 'FREE' });

    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pricePerDay: 10 });

    expect(res.status).toBe(400);
  });

  it('rejects clearing the price on a PAID item', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', borrowType: 'PAID' });

    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pricePerDay: null });

    expect(res.status).toBe(400);
  });

  it('allows updating the price on a PAID item', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', borrowType: 'PAID' });

    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pricePerDay: 12.5 });

    expect(res.status).toBe(200);
    expect(res.body.item.pricePerDay).toBe('12.50');
  });

  it('cannot edit another user\'s item', async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app).patch(`/api/items/${itemId}`).send({ title: 'Nope' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/items/:id', () => {
  it.each(['AVAILABLE', 'PAUSED'] as const)('succeeds while the item is %s', async (status) => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status });

    const res = await request(app).delete(`/api/items/${itemId}`).set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(204);
  });

  it.each(['RESERVED', 'BORROWED', 'OVERDUE'] as const)('is rejected while the item is %s', async (status) => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status });

    const res = await request(app).delete(`/api/items/${itemId}`).set('Authorization', `Bearer ${owner.accessToken}`);
    expect(res.status).toBe(409);
  });

  it('cannot delete another user\'s item', async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app).delete(`/api/items/${itemId}`).set('Authorization', `Bearer ${other.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app).delete(`/api/items/${itemId}`);
    expect(res.status).toBe(401);
  });
});
