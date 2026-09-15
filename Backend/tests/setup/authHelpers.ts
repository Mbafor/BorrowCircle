import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from './app';
import { validRegisterPayload } from './testUtils';
import { db } from '../../src/config/db';
import { users } from '../../src/db/schema';

export interface RegisteredUser {
  payload: ReturnType<typeof validRegisterPayload>;
  userId: string;
  accessToken: string;
}

export async function registerAndLogin(overrides: Partial<Record<string, string>> = {}): Promise<RegisteredUser> {
  const payload = validRegisterPayload(overrides);
  const registerRes = await request(app).post('/api/auth/register').send(payload);
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: payload.email, password: payload.password });

  return {
    payload,
    userId: registerRes.body.user.id as string,
    accessToken: loginRes.body.accessToken as string,
  };
}

/**
 * There is no self-serve way to become an admin through the API — admin
 * users are set directly in the database (users.role = 'ADMIN'). This
 * mirrors that for tests: register/login normally, then promote via a
 * direct DB write. No re-login needed — the access token only carries the
 * user id; requireAdmin re-checks role from the DB on every request.
 */
export async function registerAndLoginAdmin(overrides: Partial<Record<string, string>> = {}): Promise<RegisteredUser> {
  const admin = await registerAndLogin(overrides);
  await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, admin.userId));
  return admin;
}
