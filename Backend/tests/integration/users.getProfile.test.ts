import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/users/me', () => {
  it("returns the authenticated user's full profile including phone number", async () => {
    const { payload, accessToken } = await registerAndLogin();

    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.phoneNumber).toBe(payload.phoneNumber);
    expect(res.body.user.fullName).toBe(payload.fullName);
    expect(Array.isArray(res.body.user.items)).toBe(true);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('includes items owned by the user', async () => {
    const { userId, accessToken } = await registerAndLogin();
    await insertItem({ ownerId: userId, title: 'My Calculator' });

    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.user.items).toHaveLength(1);
    expect(res.body.user.items[0].title).toBe('My Calculator');
  });
});

describe('GET /api/users/:id', () => {
  it('returns a public profile without a phoneNumber field', async () => {
    const { userId } = await registerAndLogin();

    const res = await request(app).get(`/api/users/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.user.phoneNumber).toBeUndefined();
    expect('phoneNumber' in res.body.user).toBe(false);
  });

  it('returns 404 for a nonexistent user id', async () => {
    const res = await request(app).get('/api/users/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it("only shows items owned by that profile's user, not another user's items", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    await insertItem({ ownerId: userA.userId, title: "A's item" });
    await insertItem({ ownerId: userB.userId, title: "B's item" });

    const res = await request(app).get(`/api/users/${userA.userId}`);

    expect(res.body.user.items).toHaveLength(1);
    expect(res.body.user.items[0].title).toBe("A's item");
  });
});
