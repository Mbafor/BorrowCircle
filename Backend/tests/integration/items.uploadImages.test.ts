import request from 'supertest';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/items/:id/images', () => {
  it('succeeds with 1 image', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post(`/api/items/${itemId}/images`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('images', Buffer.from('fake-image-bytes'), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.item.imageUrls).toHaveLength(1);
  });

  it('succeeds with 3 images', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post(`/api/items/${itemId}/images`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('images', Buffer.from('a'), { filename: 'a.png', contentType: 'image/png' })
      .attach('images', Buffer.from('b'), { filename: 'b.png', contentType: 'image/png' })
      .attach('images', Buffer.from('c'), { filename: 'c.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.item.imageUrls).toHaveLength(3);
  });

  it('rejects a 4th image', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post(`/api/items/${itemId}/images`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('images', Buffer.from('a'), { filename: 'a.png', contentType: 'image/png' })
      .attach('images', Buffer.from('b'), { filename: 'b.png', contentType: 'image/png' })
      .attach('images', Buffer.from('c'), { filename: 'c.png', contentType: 'image/png' })
      .attach('images', Buffer.from('d'), { filename: 'd.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
  });

  it('rejects a non-image file', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post(`/api/items/${itemId}/images`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('images', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  it('rejects an oversized file', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const oversized = Buffer.alloc(6 * 1024 * 1024, 1);

    const res = await request(app)
      .post(`/api/items/${itemId}/images`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('images', oversized, { filename: 'huge.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
  });

  it('a non-owner cannot upload images to another user\'s item', async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post(`/api/items/${itemId}/images`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .attach('images', Buffer.from('fake-image-bytes'), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });

  it('rejects a request with no token', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post(`/api/items/${itemId}/images`)
      .attach('images', Buffer.from('fake-image-bytes'), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });
});
