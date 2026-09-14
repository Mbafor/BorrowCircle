import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { validRegisterPayload } from '../setup/testUtils';
import { env } from '../../src/config/env';

beforeEach(async () => {
  await clearDatabase();
});

async function registerAndLogin() {
  const payload = validRegisterPayload();
  await request(app).post('/api/auth/register').send(payload);
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: payload.email, password: payload.password });
  return { payload, accessToken: loginRes.body.accessToken as string };
}

describe('GET /api/auth/me', () => {
  it('returns the logged-in user profile with a valid access token', async () => {
    const { payload, accessToken } = await registerAndLogin();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(payload.email);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ sub: 'some-user-id' }, env.jwtAccessSecret, { expiresIn: '-10s' });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });
});
