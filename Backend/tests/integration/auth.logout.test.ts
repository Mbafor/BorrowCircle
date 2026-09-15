import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { validRegisterPayload, extractCookie } from '../setup/testUtils';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/auth/logout', () => {
  it("revokes the refresh token so it can no longer refresh a session", async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });

    const refreshToken = extractCookie(loginRes, 'refreshToken');
    expect(refreshToken).toBeDefined();

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`refreshToken=${refreshToken}`]);
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);
    expect(refreshRes.status).toBe(401);
  });

  it('succeeds even with no refresh token cookie present', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});
