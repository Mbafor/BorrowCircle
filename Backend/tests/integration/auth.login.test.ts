import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { extractCookie, validRegisterPayload } from '../setup/testUtils';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials, setting httpOnly access and refresh cookies with no tokens in the body', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(payload.email);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();

    const rawCookies = res.headers['set-cookie'];
    const cookies: string[] = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
    const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));

    expect(accessCookie).toBeDefined();
    expect(accessCookie?.toLowerCase()).toContain('httponly');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.toLowerCase()).toContain('httponly');
    expect(extractCookie(res, 'accessToken')).toEqual(expect.any(String));
  });

  it('fails with the wrong password', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('fails with an unknown email using the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@knust.edu.gh', password: 'WhateverPass1' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });
});
