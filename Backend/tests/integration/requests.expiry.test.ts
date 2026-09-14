import { eq } from 'drizzle-orm';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { borrowRequests, items } from '../../src/db/schema';
import { expireStaleRequests } from '../../src/services/requests.service';

beforeEach(async () => {
  await clearDatabase();
});

describe('expireStaleRequests', () => {
  it('marks a PENDING request past its expiry as EXPIRED', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
    });

    const count = await expireStaleRequests();

    expect(count).toBe(1);
    const [updated] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(updated.status).toBe('EXPIRED');
  });

  it('leaves a PENDING request with a future expiry untouched', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expireStaleRequests();

    const [unchanged] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(unchanged.status).toBe('PENDING');
  });

  it('does not touch non-PENDING requests even if their expiresAt is in the past', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'CANCELLED',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expireStaleRequests();

    const [unchanged] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(unchanged.status).toBe('CANCELLED');
  });

  // Symmetric with cancelRequest's item revert. Not reachable through the
  // real API yet (only Feature 6's accept would leave an item RESERVED under
  // a request that could then go stale), synthesized directly via the DB.
  it('reverts a RESERVED item back to AVAILABLE if left behind by an expiring request', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expireStaleRequests();

    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    expect(item.status).toBe('AVAILABLE');
  });

  it('returns 0 and does nothing when there is nothing to expire', async () => {
    const count = await expireStaleRequests();
    expect(count).toBe(0);
  });
});

describe('database-level duplicate PENDING request constraint', () => {
  it('rejects a second PENDING row for the same item+borrower even via a direct insert', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    await expect(insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' })).rejects.toThrow();
  });

  it('allows a second PENDING row for the same item+borrower once the first is no longer PENDING', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'CANCELLED' });

    await expect(insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' })).resolves.toBeDefined();
  });
});
