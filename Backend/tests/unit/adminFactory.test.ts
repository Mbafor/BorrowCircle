import { eq } from 'drizzle-orm';
import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { createAdminUser } from '../setup/adminFactory';
import { db } from '../../src/config/db';
import { users } from '../../src/db/schema';
import { verifyAccessToken } from '../../src/utils/token';

beforeEach(async () => {
  await clearDatabase();
});

describe('createAdminUser (test factory)', () => {
  it('creates a user with role ADMIN directly in the database', async () => {
    const admin = await createAdminUser();

    const [row] = await db.select().from(users).where(eq(users.id, admin.userId));
    expect(row.role).toBe('ADMIN');
  });

  it('mints an access token that verifies to the created user, usable on an admin-only route', async () => {
    const admin = await createAdminUser();

    const payload = verifyAccessToken(admin.accessToken);
    expect(payload.sub).toBe(admin.userId);

    const res = await request(app).get('/api/admin/stats').set('Cookie', `accessToken=${admin.accessToken}`);
    expect(res.status).toBe(200);
  });
});
