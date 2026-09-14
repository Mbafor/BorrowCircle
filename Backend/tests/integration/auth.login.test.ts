import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { validRegisterPayload } from '../setup/testUtils';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and returns an access token', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe(payload.email);
    expect(res.headers['set-cookie']).toBeDefined();
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
