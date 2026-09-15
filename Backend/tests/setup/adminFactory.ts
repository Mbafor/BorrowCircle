import { InsertUserOptions, insertUser } from './dbHelpers';
import { signAccessToken } from '../../src/utils/token';

export interface AdminUser {
  userId: string;
  accessToken: string;
}

/**
 * Creates an ADMIN user directly in the test database and mints a valid
 * access token for it — no HTTP round trip through register/login, and no
 * dependency on a self-serve admin-creation endpoint (there isn't one; see
 * scripts/seed-admin.ts for how this is done for real in dev/prod). This is
 * what Feature 12 (reports) and the Admin Dashboard tests use to get an
 * authenticated admin session.
 */
export async function createAdminUser(overrides: Omit<InsertUserOptions, 'role'> = {}): Promise<AdminUser> {
  const userId = await insertUser({ ...overrides, role: 'ADMIN' });
  const { token } = signAccessToken(userId);
  return { userId, accessToken: token };
}
