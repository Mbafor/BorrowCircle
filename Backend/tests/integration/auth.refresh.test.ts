import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { validRegisterPayload, extractCookie } from '../setup/testUtils';
import { db } from '../../src/config/db';
import { refreshTokens } from '../../src/db/schema';
import { hashToken, generateRandomToken } from '../../src/utils/token';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/auth/refresh', () => {
  it('exchanges a valid refresh token for a new access token for the same user', async () => {
    const payload = validRegisterPayload();
    const registerRes = await request(app).post('/api/auth/register').send(payload);
    const userId = registerRes.body.user.id as string;
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });
    const refreshToken = extractCookie(loginRes, 'refreshToken');

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    const decoded = jwt.decode(res.body.accessToken) as { sub: string };
    expect(decoded.sub).toBe(userId);
  });

  it('rotates the refresh token so the previous one cannot be reused', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });
    const refreshToken = extractCookie(loginRes, 'refreshToken');

    const firstRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);
    expect(firstRefresh.status).toBe(200);

    const secondRefresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);
    expect(secondRefresh.status).toBe(401);
  });

  it('rejects a revoked refresh token', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });
    const refreshToken = extractCookie(loginRes, 'refreshToken');

    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}`]);

    expect(res.status).toBe(401);
  });

  it('rejects an expired refresh token', async () => {
    const payload = validRegisterPayload();
    const registerRes = await request(app).post('/api/auth/register').send(payload);
    const userId = registerRes.body.user.id as string;

    const rawToken = generateRandomToken();
    await db.insert(refreshTokens).values({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawToken}`]);

    expect(res.status).toBe(401);
  });

  it('rejects a missing refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

