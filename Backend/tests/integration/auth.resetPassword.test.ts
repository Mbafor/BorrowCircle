import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { validRegisterPayload, extractCookie } from '../setup/testUtils';
import { db } from '../../src/config/db';
import { passwordResetTokens } from '../../src/db/schema';
import { hashToken, generateRandomToken } from '../../src/utils/token';
import * as emailService from '../../src/services/email';

let sendResetEmailSpy: jest.SpyInstance;

beforeEach(async () => {
  await clearDatabase();
  sendResetEmailSpy = jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(undefined);
});

async function requestResetToken(email: string): Promise<string> {
  await request(app).post('/api/auth/forgot-password').send({ email });
  const resetLink = sendResetEmailSpy.mock.calls[0][1] as string;
  const token = new URL(resetLink).searchParams.get('token');
  if (!token) {
    throw new Error('No reset token was captured');
  }
  return token;
}

describe('POST /api/auth/reset-password', () => {
  it('resets the password with a valid unexpired token and allows login with the new password', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);
    const token = await requestResetToken(payload.email);
    const newPassword = 'NewStr0ngPass!';

    const res = await request(app).post('/api/auth/reset-password').send({ token, newPassword });
    expect(res.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it('revokes existing refresh tokens after a successful reset', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });
    const oldRefreshToken = extractCookie(loginRes, 'refreshToken');

    const token = await requestResetToken(payload.email);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewStr0ngPass!' });

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${oldRefreshToken}`]);
    expect(refreshRes.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const payload = validRegisterPayload();
    const registerRes = await request(app).post('/api/auth/register').send(payload);
    const userId = registerRes.body.user.id as string;

    const rawToken = generateRandomToken();
    await db.insert(passwordResetTokens).values({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewStr0ngPass!' });

    expect(res.status).toBe(401);
  });

  it('rejects an already-used token', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);
    const token = await requestResetToken(payload.email);

    const first = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewStr0ngPass!' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'AnotherPass1!' });
    expect(second.status).toBe(401);
  });

  it('rejects a garbage/unknown token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'NewStr0ngPass!' });

    expect(res.status).toBe(401);
  });
});
