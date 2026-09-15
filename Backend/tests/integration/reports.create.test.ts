import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertItem, insertReport } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('POST /api/reports', () => {
  it('succeeds reporting an item', async () => {
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', `accessToken=${reporter.accessToken}`)
      .send({ targetType: 'ITEM', targetId: itemId, reason: 'Inappropriate content', note: 'Looks like spam' });

    expect(res.status).toBe(201);
    expect(res.body.report.targetType).toBe('ITEM');
    expect(res.body.report.status).toBe('OPEN');
  });

  it('succeeds reporting a user', async () => {
    const target = await registerAndLogin();
    const reporter = await registerAndLogin();

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', `accessToken=${reporter.accessToken}`)
      .send({ targetType: 'USER', targetId: target.userId, reason: 'Harassment' });

    expect(res.status).toBe(201);
    expect(res.body.report.targetType).toBe('USER');
    expect(res.body.report.targetId).toBe(target.userId);
  });

  it('rejects a targetId that does not exist for the given targetType', async () => {
    const reporter = await registerAndLogin();

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', `accessToken=${reporter.accessToken}`)
      .send({ targetType: 'ITEM', targetId: '00000000-0000-0000-0000-000000000000', reason: 'Fake' });

    expect(res.status).toBe(404);
  });

  it('rejects a second report on the same target while the first is still OPEN', async () => {
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId, status: 'OPEN' });

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', `accessToken=${reporter.accessToken}`)
      .send({ targetType: 'ITEM', targetId: itemId, reason: 'Still bad' });

    expect(res.status).toBe(409);
  });

  it('allows a new report on the same target once the prior one is REVIEWED', async () => {
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertReport({ reporterId: reporter.userId, targetType: 'ITEM', targetId: itemId, status: 'REVIEWED' });

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', `accessToken=${reporter.accessToken}`)
      .send({ targetType: 'ITEM', targetId: itemId, reason: 'Still an issue' });

    expect(res.status).toBe(201);
  });

  it('rejects a reason over 100 characters', async () => {
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post('/api/reports')
      .set('Cookie', `accessToken=${reporter.accessToken}`)
      .send({ targetType: 'ITEM', targetId: itemId, reason: 'a'.repeat(101) });

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const owner = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const res = await request(app)
      .post('/api/reports')
      .send({ targetType: 'ITEM', targetId: itemId, reason: 'Inappropriate content' });

    expect(res.status).toBe(401);
  });
});
