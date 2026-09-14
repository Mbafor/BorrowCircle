import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { validRegisterPayload } from '../setup/testUtils';
import { db } from '../../src/config/db';
import { users } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/auth/register', () => {
  it('registers a user with valid data', async () => {
    const payload = validRegisterPayload();

    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: payload.email,
      fullName: payload.fullName,
      phoneNumber: payload.phoneNumber,
      location: payload.location,
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it('hashes the password before storing it', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);

    const [stored] = await db.select().from(users).where(eq(users.email, payload.email)).limit(1);
    expect(stored.passwordHash).not.toBe(payload.password);
    expect(stored.passwordHash.length).toBeGreaterThan(0);
  });

  it('rejects a duplicate email', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload({ email: payload.email }));

    expect(res.status).toBe(409);
  });

  it('rejects a duplicate phone number', async () => {
    const payload = validRegisterPayload();
    await request(app).post('/api/auth/register').send(payload);

    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload({ phoneNumber: payload.phoneNumber }));

    expect(res.status).toBe(409);
  });

  it('rejects a non-university email domain', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload({ email: 'student@gmail.com' }));

    expect(res.status).toBe(400);
    expect(res.body.fields.email).toBeDefined();
  });

  it('rejects a password under 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload({ password: 'short1' }));

    expect(res.status).toBe(400);
    expect(res.body.fields.password).toBeDefined();
  });

  it('rejects a missing required field', async () => {
    const payload = validRegisterPayload();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload as any).fullName;

    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.fields.fullName).toBeDefined();
  });

  it('rejects an invalid phone number format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload({ phoneNumber: '12345' }));

    expect(res.status).toBe(400);
    expect(res.body.fields.phoneNumber).toBeDefined();
  });
});
