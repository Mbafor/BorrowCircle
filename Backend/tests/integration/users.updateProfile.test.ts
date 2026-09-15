import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('PATCH /api/users/me', () => {
  it('succeeds with valid data', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', `accessToken=${accessToken}`)
      .send({ fullName: 'Updated Name', bio: 'New bio', location: 'Unity Hall' });

    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Updated Name');
    expect(res.body.user.bio).toBe('New bio');
    expect(res.body.user.location).toBe('Unity Hall');
  });

  it('rejects a phone number already used by another user', async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', `accessToken=${userB.accessToken}`)
      .send({ phoneNumber: userA.payload.phoneNumber });

    expect(res.status).toBe(409);
  });

  it('allows a user to keep their own existing phone number unchanged', async () => {
    const { payload, accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', `accessToken=${accessToken}`)
      .send({ phoneNumber: payload.phoneNumber });

    expect(res.status).toBe(200);
  });

  it('rejects an invalid location value', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', `accessToken=${accessToken}`)
      .send({ location: 'Nonexistent Hall' });

    expect(res.status).toBe(400);
    expect(res.body.fields.location).toBeDefined();
  });

  it('rejects a bio over the max length', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', `accessToken=${accessToken}`)
      .send({ bio: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.fields.bio).toBeDefined();
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).patch('/api/users/me').send({ fullName: 'Nope' });
    expect(res.status).toBe(401);
  });

  it("identity always comes from the access token, never a body field, so a user cannot target another user's profile", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', `accessToken=${userB.accessToken}`)
      .send({ fullName: 'Only Mine To Change' });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userB.userId);

    const userAProfile = await request(app).get(`/api/users/${userA.userId}`);
    expect(userAProfile.body.user.fullName).toBe(userA.payload.fullName);

    const userBProfile = await request(app).get(`/api/users/${userB.userId}`);
    expect(userBProfile.body.user.fullName).toBe('Only Mine To Change');
  });
});
