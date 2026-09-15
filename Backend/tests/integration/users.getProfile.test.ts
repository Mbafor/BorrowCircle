import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertBorrowRequest, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/users/me', () => {
  it("returns the authenticated user's full profile including phone number", async () => {
    const { payload, accessToken } = await registerAndLogin();

    const res = await request(app).get('/api/users/me').set('Cookie', `accessToken=${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.phoneNumber).toBe(payload.phoneNumber);
    expect(res.body.user.fullName).toBe(payload.fullName);
    expect(Array.isArray(res.body.user.items)).toBe(true);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('includes items owned by the user', async () => {
    const { userId, accessToken } = await registerAndLogin();
    await insertItem({ ownerId: userId, title: 'My Calculator' });

    const res = await request(app).get('/api/users/me').set('Cookie', `accessToken=${accessToken}`);

    expect(res.body.user.items).toHaveLength(1);
    expect(res.body.user.items[0].title).toBe('My Calculator');
  });
});

describe('GET /api/users/:id', () => {
  it('returns a public profile without a phoneNumber field', async () => {
    const { userId } = await registerAndLogin();

    const res = await request(app).get(`/api/users/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.user.phoneNumber).toBeUndefined();
    expect('phoneNumber' in res.body.user).toBe(false);
  });

  it('returns 404 for a nonexistent user id', async () => {
    const res = await request(app).get('/api/users/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it("only shows items owned by that profile's user, not another user's items", async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();
    await insertItem({ ownerId: userA.userId, title: "A's item" });
    await insertItem({ ownerId: userB.userId, title: "B's item" });

    const res = await request(app).get(`/api/users/${userA.userId}`);

    expect(res.body.user.items).toHaveLength(1);
    expect(res.body.user.items[0].title).toBe("A's item");
  });

  it('excludes CANCELLED items from the public profile view, but GET /api/items/mine still shows them to the owner', async () => {
    const owner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, status: 'CANCELLED', title: 'Cancelled Item' });
    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', title: 'Live Item' });

    const publicProfile = await request(app).get(`/api/users/${owner.userId}`);
    expect(publicProfile.body.user.items).toHaveLength(1);
    expect(publicProfile.body.user.items[0].title).toBe('Live Item');

    const mine = await request(app).get('/api/items/mine').set('Cookie', `accessToken=${owner.accessToken}`);
    expect(mine.body.items).toHaveLength(2);
    expect(mine.body.items.map((item: { title: string }) => item.title).sort()).toEqual([
      'Cancelled Item',
      'Live Item',
    ]);
  });

  // Regression for Part 4's CANCELLED/REMOVED audit: getItemsForOwner's
  // publicOnly filter used to only exclude CANCELLED, so an admin-removed
  // listing still leaked through this endpoint.
  it('excludes REMOVED items from the public profile view, but GET /api/items/mine still shows them to the owner', async () => {
    const owner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, status: 'REMOVED', title: 'Removed Item' });
    await insertItem({ ownerId: owner.userId, status: 'AVAILABLE', title: 'Live Item' });

    const publicProfile = await request(app).get(`/api/users/${owner.userId}`);
    expect(publicProfile.body.user.items).toHaveLength(1);
    expect(publicProfile.body.user.items[0].title).toBe('Live Item');

    const mine = await request(app).get('/api/items/mine').set('Cookie', `accessToken=${owner.accessToken}`);
    expect(mine.body.items).toHaveLength(2);
  });

  it('shows the phone number when the viewer has an ACCEPTED or BORROWED request with the profile owner', async () => {
    const owner = await registerAndLogin();
    const borrower = await registerAndLogin();
    const itemId = await insertItem({ ownerId: owner.userId, status: 'BORROWED' });
    await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status: 'BORROWED' });

    // Either direction: the borrower viewing the owner's profile...
    const ownerProfileSeenByBorrower = await request(app)
      .get(`/api/users/${owner.userId}`)
      .set('Cookie', `accessToken=${borrower.accessToken}`);
    expect(ownerProfileSeenByBorrower.body.user.phoneNumber).toBe(owner.payload.phoneNumber);

    // ...and the owner viewing the borrower's profile.
    const borrowerProfileSeenByOwner = await request(app)
      .get(`/api/users/${borrower.userId}`)
      .set('Cookie', `accessToken=${owner.accessToken}`);
    expect(borrowerProfileSeenByOwner.body.user.phoneNumber).toBe(borrower.payload.phoneNumber);
  });

  it.each(['PENDING', 'DECLINED', 'EXPIRED', 'CANCELLED', 'RETURNED'] as const)(
    'hides the phone number when the only request between the two users is %s',
    async (status) => {
      const owner = await registerAndLogin();
      const borrower = await registerAndLogin();
      const itemId = await insertItem({ ownerId: owner.userId });
      await insertBorrowRequest({ itemId, borrowerId: borrower.userId, status });

      const res = await request(app)
        .get(`/api/users/${owner.userId}`)
        .set('Cookie', `accessToken=${borrower.accessToken}`);

      expect(res.body.user.phoneNumber).toBeUndefined();
    },
  );
});
