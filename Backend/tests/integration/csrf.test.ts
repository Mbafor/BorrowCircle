import supertest from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { validItemPayload } from '../setup/testUtils';

// Deliberately uses raw supertest (not tests/setup/request.ts, which
// auto-attaches the CSRF header every other integration test relies on) so
// these tests can omit it on purpose and prove the check actually rejects.

beforeEach(async () => {
  await clearDatabase();
});

describe('CSRF header requirement on state-changing requests', () => {
  it('rejects a POST with no X-Requested-With header, even with a valid auth cookie', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await supertest(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${accessToken}`)
      .send(validItemPayload());

    expect(res.status).toBe(403);
  });

  it('rejects a PATCH and a DELETE with no X-Requested-With header', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const patchRes = await supertest(app)
      .patch(`/api/items/${itemId}`)
      .set('Cookie', `accessToken=${owner.accessToken}`)
      .send({ title: 'Renamed' });
    expect(patchRes.status).toBe(403);

    const deleteRes = await supertest(app)
      .delete(`/api/items/${itemId}`)
      .set('Cookie', `accessToken=${owner.accessToken}`);
    expect(deleteRes.status).toBe(403);
  });

  it('does not require the header on GET requests', async () => {
    const res = await supertest(app).get('/api/items').query({});
    expect(res.status).not.toBe(403);
  });

  it('accepts a POST once the header is present', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await supertest(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${accessToken}`)
      .set('X-Requested-With', 'BorrowCircle')
      .send(validItemPayload());

    expect(res.status).toBe(201);
  });
});
