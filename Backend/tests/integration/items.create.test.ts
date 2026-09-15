import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { validItemPayload } from '../setup/testUtils';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/items', () => {
  it('creates a valid FREE listing', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${accessToken}`)
      .send(validItemPayload());

    expect(res.status).toBe(201);
    expect(res.body.item.status).toBe('AVAILABLE');
    expect(res.body.item.borrowType).toBe('FREE');
    expect(res.body.item.pricePerDay).toBeNull();
  });

  it('creates a valid PAID listing', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${accessToken}`)
      .send(validItemPayload({ borrowType: 'PAID', pricePerDay: 5 }));

    expect(res.status).toBe(201);
    expect(res.body.item.borrowType).toBe('PAID');
    expect(res.body.item.pricePerDay).toBe('5.00');
  });

  it('rejects PAID with no price', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${accessToken}`)
      .send(validItemPayload({ borrowType: 'PAID' }));

    expect(res.status).toBe(400);
    expect(res.body.fields.pricePerDay).toBeDefined();
  });

  it('rejects FREE with a price set', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${accessToken}`)
      .send(validItemPayload({ pricePerDay: 5 }));

    expect(res.status).toBe(400);
    expect(res.body.fields.pricePerDay).toBeDefined();
  });

  it('rejects an invalid category', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${accessToken}`)
      .send(validItemPayload({ category: 'Furniture' }));

    expect(res.status).toBe(400);
    expect(res.body.fields.category).toBeDefined();
  });

  it('rejects an invalid location', async () => {
    const { accessToken } = await registerAndLogin();

    const res = await request(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${accessToken}`)
      .send(validItemPayload({ location: 'Nowhere' }));

    expect(res.status).toBe(400);
    expect(res.body.fields.location).toBeDefined();
  });

  it('rejects a missing title', async () => {
    const { accessToken } = await registerAndLogin();
    const payload = validItemPayload();
    delete (payload as Record<string, unknown>).title;

    const res = await request(app).post('/api/items').set('Cookie', `accessToken=${accessToken}`).send(payload);

    expect(res.status).toBe(400);
    expect(res.body.fields.title).toBeDefined();
  });

  it('rejects a missing description', async () => {
    const { accessToken } = await registerAndLogin();
    const payload = validItemPayload();
    delete (payload as Record<string, unknown>).description;

    const res = await request(app).post('/api/items').set('Cookie', `accessToken=${accessToken}`).send(payload);

    expect(res.status).toBe(400);
    expect(res.body.fields.description).toBeDefined();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/items').send(validItemPayload());
    expect(res.status).toBe(401);
  });
});
