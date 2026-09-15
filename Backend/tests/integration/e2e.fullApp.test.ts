import request from '../setup/request';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { createAdminUser } from '../setup/adminFactory';
import { db } from '../../src/config/db';
import { borrowRequests, items } from '../../src/db/schema';

beforeEach(async () => {
  await clearDatabase();
});

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

interface NotificationRow {
  type: string;
  message: string;
}

async function notificationsFor(accessToken: string): Promise<NotificationRow[]> {
  const res = await request(app).get('/api/notifications').set('Cookie', `accessToken=${accessToken}`);
  return res.body.notifications as NotificationRow[];
}

function hasNotification(notifications: NotificationRow[], type: string): boolean {
  return notifications.some((n) => n.type === type);
}

/**
 * One long walk through the whole application, using cookie-based auth
 * throughout (Part 1), exercising the phone-visibility rule (Part 2) and the
 * CANCELLED/REMOVED exclusion fix (Part 4), and checking dashboard +
 * notification state at several checkpoints along the way rather than only
 * at the end. This is the primary evidence the system works together — see
 * the individual feature test files for exhaustive per-endpoint coverage.
 */
describe('end-to-end: the whole application, start to finish', () => {
  it('walks list -> browse -> request -> accept -> pickup -> return -> rate -> report -> remove -> pause -> cancel', async () => {
    // ---- 1. Two users register and log in. ----
    const userA = await registerAndLogin({ fullName: 'Ama Owner' });
    const userB = await registerAndLogin({ fullName: 'Kofi Borrower' });
    // eslint-disable-next-line no-console
    console.log('[1/10] Users A and B registered and logged in (cookie auth)');

    // ---- 2. User A lists a PAID item and a FREE item. ----
    const paidItemRes = await request(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${userA.accessToken}`)
      .send({
        title: 'E2E Paid Calculator',
        description: 'Scientific calculator for engineering courses.',
        category: 'Electronics',
        location: 'Unity Hall',
        borrowType: 'PAID',
        pricePerDay: 5,
      });
    expect(paidItemRes.status).toBe(201);
    const paidItemId = paidItemRes.body.item.id as string;

    const freeItemRes = await request(app)
      .post('/api/items')
      .set('Cookie', `accessToken=${userA.accessToken}`)
      .send({
        title: 'E2E Free Textbook',
        description: 'Intro to Thermodynamics, well used.',
        category: 'Academic',
        location: 'Unity Hall',
        borrowType: 'FREE',
      });
    expect(freeItemRes.status).toBe(201);
    const freeItemId = freeItemRes.body.item.id as string;
    // eslint-disable-next-line no-console
    console.log('[2/10] User A listed a PAID item and a FREE item');

    // ---- 3. Both appear in User B's browse results, with correct filtering and sorting. ----
    const browseAll = await request(app).get('/api/items').query({ location: 'Unity Hall' });
    const browseIds = browseAll.body.items.map((i: { id: string }) => i.id);
    expect(browseIds).toEqual(expect.arrayContaining([paidItemId, freeItemId]));

    const browsePaidOnly = await request(app).get('/api/items').query({ borrowType: 'PAID' });
    expect(browsePaidOnly.body.items.map((i: { id: string }) => i.id)).toEqual([paidItemId]);

    const browseSortedAsc = await request(app)
      .get('/api/items')
      .query({ location: 'Unity Hall', sort: 'price_asc' });
    const sortedIds = browseSortedAsc.body.items.map((i: { id: string }) => i.id);
    // FREE (treated as price 0) sorts before the PAID item.
    expect(sortedIds.indexOf(freeItemId)).toBeLessThan(sortedIds.indexOf(paidItemId));

    // Checkpoint 1: A's dashboard summary reflects both live listings.
    const summaryAfterListing = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `accessToken=${userA.accessToken}`);
    expect(summaryAfterListing.body.itemsListed).toBe(2);
    // eslint-disable-next-line no-console
    console.log('[3/10] Both items browsable with correct filter/sort; dashboard checkpoint 1 OK (itemsListed=2)');

    // ---- 4. User B sends a borrow request on the PAID item. ----
    const createRequestRes = await request(app)
      .post('/api/requests')
      .set('Cookie', `accessToken=${userB.accessToken}`)
      .send({ itemId: paidItemId, pickupDate: futureDate(1), returnDate: futureDate(3) });
    expect(createRequestRes.status).toBe(201);
    const requestId = createRequestRes.body.request.id as string;
    expect(createRequestRes.body.request.status).toBe('PENDING');

    expect(hasNotification(await notificationsFor(userA.accessToken), 'REQUEST_SENT')).toBe(true);
    // eslint-disable-next-line no-console
    console.log('[4/10] User B sent a borrow request on the PAID item (PENDING); A notified (REQUEST_SENT)');

    // ---- 5. User A accepts it. ----
    const acceptRes = await request(app)
      .patch(`/api/requests/${requestId}/accept`)
      .set('Cookie', `accessToken=${userA.accessToken}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.request.status).toBe('ACCEPTED');
    expect(hasNotification(await notificationsFor(userB.accessToken), 'REQUEST_ACCEPTED')).toBe(true);

    // The other listing is untouched.
    const freeItemAfterAccept = await request(app).get(`/api/items/${freeItemId}`);
    expect(freeItemAfterAccept.body.item.status).toBe('AVAILABLE');
    const [paidItemAfterAccept] = await db.select().from(items).where(eq(items.id, paidItemId));
    expect(paidItemAfterAccept.status).toBe('RESERVED');

    // Phone numbers are now visible between A and B (Part 2), either direction.
    const aProfileSeenByB = await request(app)
      .get(`/api/users/${userA.userId}`)
      .set('Cookie', `accessToken=${userB.accessToken}`);
    expect(aProfileSeenByB.body.user.phoneNumber).toBe(userA.payload.phoneNumber);
    const bProfileSeenByA = await request(app)
      .get(`/api/users/${userB.userId}`)
      .set('Cookie', `accessToken=${userA.accessToken}`);
    expect(bProfileSeenByA.body.user.phoneNumber).toBe(userB.payload.phoneNumber);
    // eslint-disable-next-line no-console
    console.log(
      '[5/10] A accepted the request (item RESERVED, FREE item untouched); phone numbers now visible both directions',
    );

    // ---- 6. A confirms pickup; B confirms return. ----
    const borrowerView = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${userB.accessToken}`);
    const pickupCode = borrowerView.body.request.pickupCode as string;

    const confirmPickupRes = await request(app)
      .patch(`/api/requests/${requestId}/confirm-pickup`)
      .set('Cookie', `accessToken=${userA.accessToken}`)
      .send({ pickupCode });
    expect(confirmPickupRes.status).toBe(200);
    expect(confirmPickupRes.body.request.status).toBe('BORROWED');
    expect(hasNotification(await notificationsFor(userB.accessToken), 'HANDOVER_CONFIRMED')).toBe(true);

    // Checkpoint 2: B's dashboard summary shows one active borrow while it's out.
    const summaryDuringBorrow = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `accessToken=${userB.accessToken}`);
    expect(summaryDuringBorrow.body.activeBorrows).toBe(1);

    const ownerView = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Cookie', `accessToken=${userA.accessToken}`);
    const returnCode = ownerView.body.request.returnCode as string;

    const confirmReturnRes = await request(app)
      .patch(`/api/requests/${requestId}/confirm-return`)
      .set('Cookie', `accessToken=${userB.accessToken}`)
      .send({ returnCode });
    expect(confirmReturnRes.status).toBe(200);
    expect(confirmReturnRes.body.request.status).toBe('RETURNED');
    expect(hasNotification(await notificationsFor(userA.accessToken), 'RETURN_CONFIRMED')).toBe(true);

    const [paidItemAfterReturn] = await db.select().from(items).where(eq(items.id, paidItemId));
    expect(paidItemAfterReturn.status).toBe('AVAILABLE');

    // Checkpoint 3: B's dashboard summary drops back to 0 active borrows.
    const summaryAfterReturn = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', `accessToken=${userB.accessToken}`);
    expect(summaryAfterReturn.body.activeBorrows).toBe(0);

    // Phone numbers revert to hidden now that no ACCEPTED/BORROWED request
    // exists between A and B (Part 2's existence check, not a permanent unlock).
    const aProfileAfterReturn = await request(app)
      .get(`/api/users/${userA.userId}`)
      .set('Cookie', `accessToken=${userB.accessToken}`);
    expect(aProfileAfterReturn.body.user.phoneNumber).toBeUndefined();
    // eslint-disable-next-line no-console
    console.log(
      '[6/10] Pickup confirmed (BORROWED, dashboard checkpoint 2: activeBorrows=1) -> return confirmed ' +
        '(AVAILABLE again, dashboard checkpoint 3: activeBorrows=0); phone numbers reverted to hidden',
    );

    // ---- 7. Both rate each other; average_rating updates on both. ----
    const ratingByB = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${userB.accessToken}`)
      .send({ borrowRequestId: requestId, score: 5, comment: 'Great lender!' });
    expect(ratingByB.status).toBe(201);

    const ratingByA = await request(app)
      .post('/api/ratings')
      .set('Cookie', `accessToken=${userA.accessToken}`)
      .send({ borrowRequestId: requestId, score: 4, comment: 'Returned on time.' });
    expect(ratingByA.status).toBe(201);

    expect(hasNotification(await notificationsFor(userA.accessToken), 'RATING_RECEIVED')).toBe(true);
    expect(hasNotification(await notificationsFor(userB.accessToken), 'RATING_RECEIVED')).toBe(true);

    const aPublicProfile = await request(app).get(`/api/users/${userA.userId}`);
    expect(Number(aPublicProfile.body.user.averageRating)).toBe(5);
    const bPublicProfile = await request(app).get(`/api/users/${userB.userId}`);
    expect(Number(bPublicProfile.body.user.averageRating)).toBe(4);
    // eslint-disable-next-line no-console
    console.log('[7/10] Both users rated each other; average_rating updated on both profiles (A=5, B=4)');

    // ---- 8. B reports the FREE item; an admin reviews and removes it. ----
    const reportRes = await request(app)
      .post('/api/reports')
      .set('Cookie', `accessToken=${userB.accessToken}`)
      .send({ targetType: 'ITEM', targetId: freeItemId, reason: 'Item no longer available in person' });
    expect(reportRes.status).toBe(201);
    const reportId = reportRes.body.report.id as string;

    const admin = await createAdminUser();
    const removeRes = await request(app)
      .post(`/api/reports/${reportId}/remove-item`)
      .set('Cookie', `accessToken=${admin.accessToken}`);
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.report.status).toBe('REVIEWED');

    const [freeItemAfterRemoval] = await db.select().from(items).where(eq(items.id, freeItemId));
    expect(freeItemAfterRemoval.status).toBe('REMOVED');

    // Disappears from browse (already-correct behavior — browse allowlists AVAILABLE only)...
    const browseAfterRemoval = await request(app).get('/api/items').query({ location: 'Unity Hall' });
    expect(browseAfterRemoval.body.items.map((i: { id: string }) => i.id)).not.toContain(freeItemId);
    // ...and from A's public profile item list (Part 4's actual fix: this
    // used to only exclude CANCELLED, letting a REMOVED item leak through).
    const aProfileAfterRemoval = await request(app).get(`/api/users/${userA.userId}`);
    expect(
      aProfileAfterRemoval.body.user.items.map((i: { id: string }) => i.id),
    ).not.toContain(freeItemId);

    expect(hasNotification(await notificationsFor(userA.accessToken), 'ITEM_CANCELLED')).toBe(true);
    // eslint-disable-next-line no-console
    console.log(
      '[8/10] B reported the FREE item; admin removed it (REMOVED) — gone from browse and A\'s public profile',
    );

    // ---- 9. A pauses the remaining (PAID) item, then cancels it. ----
    // A fresh PENDING request first, so cancellation has something to cascade.
    const secondRequestRes = await request(app)
      .post('/api/requests')
      .set('Cookie', `accessToken=${userB.accessToken}`)
      .send({ itemId: paidItemId, pickupDate: futureDate(5), returnDate: futureDate(7) });
    expect(secondRequestRes.status).toBe(201);
    const secondRequestId = secondRequestRes.body.request.id as string;

    const pauseRes = await request(app)
      .patch(`/api/items/${paidItemId}/status`)
      .set('Cookie', `accessToken=${userA.accessToken}`)
      .send({ status: 'PAUSED' });
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.item.status).toBe('PAUSED');

    // Pausing must not cascade — the pending request survives untouched.
    const [secondRequestAfterPause] = await db
      .select()
      .from(borrowRequests)
      .where(eq(borrowRequests.id, secondRequestId));
    expect(secondRequestAfterPause.status).toBe('PENDING');

    const cancelRes = await request(app)
      .patch(`/api/items/${paidItemId}/status`)
      .set('Cookie', `accessToken=${userA.accessToken}`)
      .send({ status: 'CANCELLED' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.item.status).toBe('CANCELLED');

    // Cancelling does cascade: the pending request is cancelled with it.
    const [secondRequestAfterCancel] = await db
      .select()
      .from(borrowRequests)
      .where(eq(borrowRequests.id, secondRequestId));
    expect(secondRequestAfterCancel.status).toBe('CANCELLED');

    const notificationsForB = await notificationsFor(userB.accessToken);
    const cascadeNotification = notificationsForB.find(
      (n) => n.type === 'ITEM_CANCELLED' && n.message.includes('lender cancelled'),
    );
    expect(cascadeNotification).toBeDefined();
    // eslint-disable-next-line no-console
    console.log(
      '[9/10] A paused then cancelled the PAID item — pause left the pending request untouched, ' +
        'cancel cascaded it to CANCELLED with B notified',
    );
    // eslint-disable-next-line no-console
    console.log('[10/10] Dashboard and notification state verified at every checkpoint above — full walk complete');
  });
});
