import request from '../setup/request';
import jwt from 'jsonwebtoken';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { extractCookie, validRegisterPayload } from '../setup/testUtils';
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
  return { payload, accessToken: extractCookie(loginRes, 'accessToken') as string };
}

describe('GET /api/auth/me', () => {
  it('returns the logged-in user profile with a valid access cookie', async () => {
    const { payload, accessToken } = await registerAndLogin();

    const res = await request(app).get('/api/auth/me').set('Cookie', `accessToken=${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(payload.email);
  });

  it('rejects a request with no access cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed access cookie', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'accessToken=not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects an expired access cookie', async () => {
    const expired = jwt.sign({ sub: 'some-user-id' }, env.jwtAccessSecret, { expiresIn: '-10s' });

    const res = await request(app).get('/api/auth/me').set('Cookie', `accessToken=${expired}`);

    expect(res.status).toBe(401);
  });
});
