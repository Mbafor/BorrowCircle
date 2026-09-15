import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/users/me/photo', () => {
  it('succeeds with a valid image and updates profileImageUrl', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/users/me/photo')
      .set('Cookie', `accessToken=${accessToken}`)
      .attach('photo', Buffer.from('fake-image-bytes'), { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(typeof res.body.user.profileImageUrl).toBe('string');
    expect(res.body.user.profileImageUrl.length).toBeGreaterThan(0);
  });

  it('rejects a non-image file', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/users/me/photo')
      .set('Cookie', `accessToken=${accessToken}`)
      .attach('photo', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  it('rejects an oversized file', async () => {
    const { accessToken } = await registerAndLogin();
    const oversized = Buffer.alloc(6 * 1024 * 1024, 1);

    const res = await request(app)
      .post('/api/users/me/photo')
      .set('Cookie', `accessToken=${accessToken}`)
      .attach('photo', oversized, { filename: 'huge.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
  });

  it('rejects a request with no file', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app).post('/api/users/me/photo').set('Cookie', `accessToken=${accessToken}`);

    expect(res.status).toBe(400);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app)
      .post('/api/users/me/photo')
      .attach('photo', Buffer.from('fake-image-bytes'), { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });
});
