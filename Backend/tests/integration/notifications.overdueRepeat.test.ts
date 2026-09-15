import { and, eq } from 'drizzle-orm';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { borrowRequests, notifications } from '../../src/db/schema';
import { flagOverdueRequests } from '../../src/services/requests.service';

beforeEach(async () => {
  await clearDatabase();
});

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function overdueNotificationsFor(userId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, 'OVERDUE')));
}

describe('overdue repeat notifications', () => {
  it('a request that just became overdue gets exactly one OVERDUE notification (borrower and owner)', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(-2),
    });

    await flagOverdueRequests();

    expect(await overdueNotificationsFor(borrower.userId)).toHaveLength(1);
    expect(await overdueNotificationsFor(owner.userId)).toHaveLength(1);
  });

  it('running flagOverdueRequests() again within 24 hours does not create a second notification', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(-2),
    });

    await flagOverdueRequests();
    await flagOverdueRequests();
    await flagOverdueRequests();

    expect(await overdueNotificationsFor(borrower.userId)).toHaveLength(1);
  });

  it('running it again after last_overdue_notified_at is more than 24h old creates exactly one more', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(-2),
    });

    await flagOverdueRequests();
    expect(await overdueNotificationsFor(borrower.userId)).toHaveLength(1);

    // Simulate 25 hours having passed since the last notification.
    await db
      .update(borrowRequests)
      .set({ lastOverdueNotifiedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(borrowRequests.id, requestId));

    await flagOverdueRequests();

    expect(await overdueNotificationsFor(borrower.userId)).toHaveLength(2);
  });

  it('a request that gets returned while overdue stops generating further OVERDUE notifications', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnDate: daysFromToday(-2),
    });

    await flagOverdueRequests();
    expect(await overdueNotificationsFor(borrower.userId)).toHaveLength(1);

    // Mark it RETURNED directly (equivalent to a successful confirm-return),
    // and roll last_overdue_notified_at back so it *would* be due again if
    // the query didn't correctly exclude non-OVERDUE requests.
    await db
      .update(borrowRequests)
      .set({ status: 'RETURNED', lastOverdueNotifiedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(borrowRequests.id, requestId));

    await flagOverdueRequests();

    // Still just the one notification from before — RETURNED is excluded
    // by the `status = 'OVERDUE'` clause, no special-case needed.
    expect(await overdueNotificationsFor(borrower.userId)).toHaveLength(1);
  });
});
