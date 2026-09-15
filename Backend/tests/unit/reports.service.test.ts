import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { createReport } from '../../src/services/reports.service';

beforeEach(async () => {
  await clearDatabase();
});

describe('createReport — target validation', () => {
  it('succeeds reporting an existing item', async () => {
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    const report = await createReport(reporter.userId, {
      targetType: 'ITEM',
      targetId: itemId,
      reason: 'Inappropriate content',
    });

    expect(report.targetType).toBe('ITEM');
    expect(report.targetId).toBe(itemId);
    expect(report.status).toBe('OPEN');
  });

  it('succeeds reporting an existing user', async () => {
    const target = await registerAndLogin();
    const reporter = await registerAndLogin();

    const report = await createReport(reporter.userId, {
      targetType: 'USER',
      targetId: target.userId,
      reason: 'Harassment',
    });

    expect(report.targetType).toBe('USER');
    expect(report.targetId).toBe(target.userId);
  });

  it('rejects an item targetId that does not exist', async () => {
    const reporter = await registerAndLogin();

    await expect(
      createReport(reporter.userId, {
        targetType: 'ITEM',
        targetId: '00000000-0000-0000-0000-000000000000',
        reason: 'Fake listing',
      }),
    ).rejects.toThrow();
  });

  it('rejects a user targetId that does not exist', async () => {
    const reporter = await registerAndLogin();

    await expect(
      createReport(reporter.userId, {
        targetType: 'USER',
        targetId: '00000000-0000-0000-0000-000000000000',
        reason: 'Scam',
      }),
    ).rejects.toThrow();
  });
});

describe('createReport — duplicate-open-report detection', () => {
  it('rejects a second report on the same target while the first is still OPEN', async () => {
    const owner = await registerAndLogin();
    const reporter = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    await createReport(reporter.userId, { targetType: 'ITEM', targetId: itemId, reason: 'First reason' });

    await expect(
      createReport(reporter.userId, { targetType: 'ITEM', targetId: itemId, reason: 'Second reason' }),
    ).rejects.toThrow();
  });

  it('allows two different reporters to report the same target', async () => {
    const owner = await registerAndLogin();
    const reporterA = await registerAndLogin();
    const reporterB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });

    await createReport(reporterA.userId, { targetType: 'ITEM', targetId: itemId, reason: 'Reason A' });
    const reportB = await createReport(reporterB.userId, { targetType: 'ITEM', targetId: itemId, reason: 'Reason B' });

    expect(reportB.reporterId).toBe(reporterB.userId);
  });
});
