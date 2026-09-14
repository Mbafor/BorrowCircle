import request from 'supertest';
import { app } from './app';
import { validRegisterPayload } from './testUtils';

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
