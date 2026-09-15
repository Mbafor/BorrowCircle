import request from './request';
import { extractCookie, validRegisterPayload } from './testUtils';
import { app } from './app';

export interface RegisteredUser {
  payload: ReturnType<typeof validRegisterPayload>;
  userId: string;
  // Kept as `accessToken` (not `accessTokenCookie`) so every existing call
  // site — `.set('Cookie', \`accessToken=${x.accessToken}\`)` — reads the
  // same as before Part 1's cookie migration; only the header name changed.
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
    accessToken: extractCookie(loginRes, 'accessToken') as string,
  };
}
