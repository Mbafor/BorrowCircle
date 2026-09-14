import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { validRegisterPayload } from '../setup/testUtils';
import { db } from '../../src/config/db';
import { passwordResetTokens } from '../../src/db/schema';
import * as emailService from '../../src/services/email';

beforeEach(async () => {
  await clearDatabase();
  jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(undefined);
});

describe('POST /api/auth/forgot-password', () => {
  it('returns a generic success response for an existing email and creates a token', async () => {
    const payload = validRegisterPayload();
    const registerRes = await request(app).post('/api/auth/register').send(payload);
    const userId = registerRes.body.user.id as string;

    const res = await request(app).post('/api/auth/forgot-password').send({ email: payload.email });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    const tokens = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    expect(tokens).toHaveLength(1);
  });

  it('returns the same generic success response for a non-existing email without creating a token', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@knust.edu.gh' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();

    const tokens = await db.select().from(passwordResetTokens);
    expect(tokens).toHaveLength(0);
  });

  it('returns identical response bodies for existing and non-existing emails', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);

    const existingRes = await request(app).post('/api/auth/forgot-password').send({ email: payload.email });
    const missingRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@knust.edu.gh' });

    expect(existingRes.body).toEqual(missingRes.body);
    expect(existingRes.status).toBe(missingRes.status);
  });
});
