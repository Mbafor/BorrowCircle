import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { db } from '../../src/config/db';
import { notifications } from '../../src/db/schema';
import { expireStaleRequests } from '../../src/services/requests.service';

beforeEach(async () => {
  await clearDatabase();
});

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function notificationsFor(userId: string, type?: string) {
  const whereClause = type
    ? and(eq(notifications.userId, userId), eq(notifications.type, type as never))
    : eq(notifications.userId, userId);
  return db.select().from(notifications).where(whereClause);
}

describe('notification events', () => {
  it('send request: notifies the item owner with REQUEST_SENT', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });

    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send({ itemId, pickupDate: futureDate(1), returnDate: futureDate(3) });
    const requestId = res.body.request.id as string;

    const ownerNotifications = await notificationsFor(owner.userId, 'REQUEST_SENT');
    expect(ownerNotifications).toHaveLength(1);
    expect(ownerNotifications[0].targetType).toBe('BORROW_REQUEST');
    expect(ownerNotifications[0].targetId).toBe(requestId);
  });

  it("borrower cancels their own request: notifies the owner with REQUEST_CANCELLED", async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    await request(app)
      .patch(`/api/requests/${requestId}/cancel`)
      .set('Authorization', `Bearer ${borrower.accessToken}`);

    const ownerNotifications = await notificationsFor(owner.userId, 'REQUEST_CANCELLED');
    expect(ownerNotifications).toHaveLength(1);
    expect(ownerNotifications[0].message.toLowerCase()).toContain('borrower');
    expect(ownerNotifications[0].targetId).toBe(requestId);
  });

  it('auto-expiry: notifies the borrower with REQUEST_EXPIRED', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expireStaleRequests();

    const borrowerNotifications = await notificationsFor(borrower.userId, 'REQUEST_EXPIRED');
    expect(borrowerNotifications).toHaveLength(1);
    expect(borrowerNotifications[0].targetId).toBe(requestId);
  });

  it('manual accept: notifies the winner with REQUEST_ACCEPTED and the auto-declined loser with REQUEST_DECLINED', async () => {
    const owner = await registerAndLogin();
    const winner = await registerAndLogin();
    const loser = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const winningRequest = await insertBorrowRequest({ itemId, borrowerId: winner.userId, status: 'PENDING' });
    const losingRequest = await insertBorrowRequest({ itemId, borrowerId: loser.userId, status: 'PENDING' });

    await request(app)
      .patch(`/api/requests/${winningRequest}/accept`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const winnerNotifications = await notificationsFor(winner.userId, 'REQUEST_ACCEPTED');
    expect(winnerNotifications).toHaveLength(1);
    expect(winnerNotifications[0].targetId).toBe(winningRequest);

    const loserNotifications = await notificationsFor(loser.userId, 'REQUEST_DECLINED');
    expect(loserNotifications).toHaveLength(1);
    expect(loserNotifications[0].targetId).toBe(losingRequest);
    expect(loserNotifications[0].message.toLowerCase()).toContain('reserved');
  });

  it('manual decline with a reason: notifies the borrower with REQUEST_DECLINED including the reason', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const requestId = await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'PENDING' });

    await request(app)
      .patch(`/api/requests/${requestId}/decline`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ reason: 'Already lent it out' });

    const borrowerNotifications = await notificationsFor(borrower.userId, 'REQUEST_DECLINED');
    expect(borrowerNotifications).toHaveLength(1);
    expect(borrowerNotifications[0].message).toContain('Already lent it out');
    expect(borrowerNotifications[0].targetId).toBe(requestId);
  });

  it('confirm pickup: notifies both the owner and the borrower with HANDOVER_CONFIRMED', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'RESERVED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'ACCEPTED',
      pickupCode: '111222',
    });

    await request(app)
      .patch(`/api/requests/${requestId}/confirm-pickup`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pickupCode: '111222' });

    const ownerNotifications = await notificationsFor(owner.userId, 'HANDOVER_CONFIRMED');
    const borrowerNotifications = await notificationsFor(borrower.userId, 'HANDOVER_CONFIRMED');
    expect(ownerNotifications).toHaveLength(1);
    expect(borrowerNotifications).toHaveLength(1);
    expect(ownerNotifications[0].targetId).toBe(requestId);
    expect(borrowerNotifications[0].targetId).toBe(requestId);
  });

  it('confirm return: notifies both the owner and the borrower with RETURN_CONFIRMED', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    const requestId = await insertBorrowRequest({
      itemId,
      borrowerId: borrower.userId,
      status: 'BORROWED',
      returnCode: '333444',
    });

    await request(app)
      .patch(`/api/requests/${requestId}/confirm-return`)
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send({ returnCode: '333444' });

    const ownerNotifications = await notificationsFor(owner.userId, 'RETURN_CONFIRMED');
    const borrowerNotifications = await notificationsFor(borrower.userId, 'RETURN_CONFIRMED');
    expect(ownerNotifications).toHaveLength(1);
    expect(borrowerNotifications).toHaveLength(1);
    expect(ownerNotifications[0].targetId).toBe(requestId);
  });

  it('item-cancellation cascade: notifies each affected borrower with ITEM_CANCELLED, distinct from borrower-initiated cancellation', async () => {
    const owner = await registerAndLogin();
    const borrowerA = await registerAndLogin();
    const borrowerB = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    await insertBorrowRequest({ itemId, borrowerId: borrowerA.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId, borrowerId: borrowerB.userId, status: 'PENDING' });

    await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ status: 'CANCELLED' });

    const aNotifications = await notificationsFor(borrowerA.userId, 'ITEM_CANCELLED');
    const bNotifications = await notificationsFor(borrowerB.userId, 'ITEM_CANCELLED');
    expect(aNotifications).toHaveLength(1);
    expect(bNotifications).toHaveLength(1);
    expect(aNotifications[0].targetType).toBe('ITEM');
    expect(aNotifications[0].targetId).toBe(itemId);
    expect(aNotifications[0].message.toLowerCase()).toContain('lender');

    // Distinct from a borrower cancelling their own request.
    expect(await notificationsFor(borrowerA.userId, 'REQUEST_CANCELLED')).toHaveLength(0);
  });

  it('winner and loser end up with exactly one notification each, not a duplicate from AUTO_DECLINE_REASON matching', async () => {
    const owner = await registerAndLogin();
    const winner = await registerAndLogin();
    const loser = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'AVAILABLE' });
    const winningRequest = await insertBorrowRequest({ itemId, borrowerId: winner.userId, status: 'PENDING' });
    await insertBorrowRequest({ itemId, borrowerId: loser.userId, status: 'PENDING' });

    await request(app)
      .patch(`/api/requests/${winningRequest}/accept`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const allWinnerNotifications = await notificationsFor(winner.userId);
    const allLoserNotifications = await notificationsFor(loser.userId);
    expect(allWinnerNotifications).toHaveLength(1);
    expect(allLoserNotifications).toHaveLength(1);
  });
});
