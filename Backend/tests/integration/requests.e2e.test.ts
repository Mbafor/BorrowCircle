import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../setup/app';
import { clearDatabase } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';
import { validItemPayload } from '../setup/testUtils';
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

describe('end-to-end: list -> request -> accept -> pickup -> return', () => {
  it('walks the full chain and the item ends up AVAILABLE again', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();

    // 1. Owner creates an item.
    const createItemRes = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(validItemPayload());
    expect(createItemRes.status).toBe(201);
    const itemId = createItemRes.body.item.id as string;

    // 2. Borrower sends a request.
    const createRequestRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send({ itemId, pickupDate: futureDate(1), returnDate: futureDate(3) });
    expect(createRequestRes.status).toBe(201);
    const requestId = createRequestRes.body.request.id as string;
    expect(createRequestRes.body.request.status).toBe('PENDING');

    // 3. Owner accepts it.
    const acceptRes = await request(app)
      .patch(`/api/requests/${requestId}/accept`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.request.status).toBe('ACCEPTED');

    const [itemAfterAccept] = await db.select().from(items).where(eq(items.id, itemId));
    expect(itemAfterAccept.status).toBe('RESERVED');

    // Pull the real pickup code the borrower would read off their own view.
    const borrowerView = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Authorization', `Bearer ${borrower.accessToken}`);
    const pickupCode = borrowerView.body.request.pickupCode as string;
    expect(pickupCode).toMatch(/^\d{6}$/);

    // 4. Owner confirms pickup with the code the borrower read out to them.
    const confirmPickupRes = await request(app)
      .patch(`/api/requests/${requestId}/confirm-pickup`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ pickupCode });
    expect(confirmPickupRes.status).toBe(200);
    expect(confirmPickupRes.body.request.status).toBe('BORROWED');

    const [itemAfterPickup] = await db.select().from(items).where(eq(items.id, itemId));
    expect(itemAfterPickup.status).toBe('BORROWED');

    // Pull the real return code the owner would read off their own view.
    const ownerView = await request(app)
      .get(`/api/requests/${requestId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    const returnCode = ownerView.body.request.returnCode as string;
    expect(returnCode).toMatch(/^\d{6}$/);

    // 5. Borrower confirms return with the code the owner read out to them.
    const confirmReturnRes = await request(app)
      .patch(`/api/requests/${requestId}/confirm-return`)
      .set('Authorization', `Bearer ${borrower.accessToken}`)
      .send({ returnCode });
    expect(confirmReturnRes.status).toBe(200);
    expect(confirmReturnRes.body.request.status).toBe('RETURNED');

    // 6. Item is AVAILABLE again.
    const [finalItem] = await db.select().from(items).where(eq(items.id, itemId));
    expect(finalItem.status).toBe('AVAILABLE');

    const [finalRequest] = await db.select().from(borrowRequests).where(eq(borrowRequests.id, requestId));
    expect(finalRequest.status).toBe('RETURNED');
    expect(finalRequest.pickupCode).toBe(pickupCode);
    expect(finalRequest.returnCode).toBe(returnCode);
  });
});
