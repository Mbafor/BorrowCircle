import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { extractCookie } from '../setup/testUtils';
import { db } from '../../src/config/db';
import { items, users } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('DELETE /api/users/me', () => {
  it('succeeds and anonymizes the profile when the user has no reserved/borrowed items', async () => {
    const { userId, accessToken } = await registerAndLogin();

    const res = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(user.status).toBe('DELETED');
    expect(user.fullName).toBe('Deleted User');
    expect(user.bio).toBeNull();
    expect(user.profileImageUrl).toBeNull();
  });

  it('is blocked with a clear error when the user has a RESERVED item', async () => {
    const { userId, accessToken } = await registerAndLogin();
    await insertItem({ ownerId: userId, status: 'RESERVED' });

    const res = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toBeDefined();

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(user.status).toBe('ACTIVE');
  });

  it('is blocked when the user has a BORROWED item', async () => {
    const { userId, accessToken } = await registerAndLogin();
    await insertItem({ ownerId: userId, status: 'BORROWED' });

    const res = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
  });

  it("cancels the user's AVAILABLE/PAUSED items so they no longer appear as available", async () => {
    const { userId, accessToken } = await registerAndLogin();
    const availableId = await insertItem({ ownerId: userId, status: 'AVAILABLE', title: 'Item A' });
    const pausedId = await insertItem({ ownerId: userId, status: 'PAUSED', title: 'Item B' });

    const res = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);

    const availableItems = await db.select().from(items).where(eq(items.status, 'AVAILABLE'));
    expect(availableItems.find((item) => item.id === availableId)).toBeUndefined();

    const [itemA] = await db.select().from(items).where(eq(items.id, availableId));
    const [itemB] = await db.select().from(items).where(eq(items.id, pausedId));
    expect(itemA.status).toBe('CANCELLED');
    expect(itemB.status).toBe('CANCELLED');
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).delete('/api/users/me');
    expect(res.status).toBe(401);
  });

  it("revokes the deleted user's existing refresh tokens", async () => {
    const { payload, accessToken } = await registerAndLogin();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });
    const refreshToken = extractCookie(loginRes, 'refreshToken');

    const deleteRes = await request(app).delete('/api/users/me').set('Authorization', `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);
    expect(refreshRes.status).toBe(401);
  });
});
