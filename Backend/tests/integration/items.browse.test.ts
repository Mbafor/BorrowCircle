import request from '../setup/request';
import { app } from '../setup/app';
import { clearDatabase, insertItem } from '../setup/dbHelpers';
import { registerAndLogin } from '../setup/authHelpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('GET /api/items', () => {
  it('returns only AVAILABLE items, excluding every other status', async () => {
    const owner = await registerAndLogin();
    const statuses = ['AVAILABLE', 'RESERVED', 'BORROWED', 'OVERDUE', 'PAUSED', 'CANCELLED'] as const;
    for (const status of statuses) {
      await insertItem({ ownerId: owner.userId, status, title: `Item ${status}` });
    }

    const res = await request(app).get('/api/items');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe('AVAILABLE');
    expect(res.body.items[0].title).toBe('Item AVAILABLE');
  });

  it('works with no authentication at all', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
  });

  it('includes owner name, rating, and first image without requiring auth', async () => {
    const owner = await registerAndLogin();
    await insertItem({ ownerId: owner.userId, title: 'Has Owner Info' });

    const res = await request(app).get('/api/items');

    expect(res.body.items[0].ownerId).toBe(owner.userId);
    expect(res.body.items[0].ownerName).toBe(owner.payload.fullName);
    expect(typeof res.body.items[0].ownerAverageRating).toBe('string');
    expect(res.body.items[0].imageUrl).toBeNull();
  });

  describe('search', () => {
    it('matches on title', async () => {
      const owner = await registerAndLogin();
      await insertItem({ ownerId: owner.userId, title: 'Scientific Calculator' });
      await insertItem({ ownerId: owner.userId, title: 'Lab Coat' });

      const res = await request(app).get('/api/items').query({ search: 'Calculator' });

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Scientific Calculator');
    });

    it('matches on description', async () => {
      const owner = await registerAndLogin();
      await insertItem({ ownerId: owner.userId, title: 'Item A', description: 'Great for engineering courses' });
      await insertItem({ ownerId: owner.userId, title: 'Item B', description: 'Just a coat' });

      const res = await request(app).get('/api/items').query({ search: 'engineering' });

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('Item A');
    });

    it('is case-insensitive', async () => {
      const owner = await registerAndLogin();
      await insertItem({ ownerId: owner.userId, title: 'Scientific Calculator' });

      const res = await request(app).get('/api/items').query({ search: 'CALCULATOR' });

      expect(res.body.items).toHaveLength(1);
    });

    it('returns an empty array with 200 when nothing matches', async () => {
      const owner = await registerAndLogin();
      await insertItem({ ownerId: owner.userId, title: 'Scientific Calculator' });

      const res = await request(app).get('/api/items').query({ search: 'nonexistentxyz' });

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });
  });

  describe('category filter', () => {
    it('returns only matching items', async () => {
      const owner = await registerAndLogin();
      await insertItem({ ownerId: owner.userId, category: 'Electronics', title: 'A' });
      await insertItem({ ownerId: owner.userId, category: 'Fashion', title: 'B' });

      const res = await request(app).get('/api/items').query({ category: 'Electronics' });

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('A');
    });

    it('rejects an invalid category with 400', async () => {
      const res = await request(app).get('/api/items').query({ category: 'Furniture' });
      expect(res.status).toBe(400);
    });
  });

  describe('location filter', () => {
    it('returns only matching items', async () => {
      const owner = await registerAndLogin();
      await insertItem({ ownerId: owner.userId, location: 'Unity Hall', title: 'A' });
      await insertItem({ ownerId: owner.userId, location: 'Kotei', title: 'B' });

      const res = await request(app).get('/api/items').query({ location: 'Unity Hall' });

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].title).toBe('A');
    });

    it('rejects an invalid location with 400', async () => {
      const res = await request(app).get('/api/items').query({ location: 'Nowhere' });
      expect(res.status).toBe(400);
    });
  });

  describe('borrowType filter', () => {
    it('isolates FREE vs PAID items', async () => {
      const owner = await registerAndLogin();
      await insertItem({ ownerId: owner.userId, borrowType: 'FREE', title: 'Free Item' });
      await insertItem({ ownerId: owner.userId, borrowType: 'PAID', pricePerDay: '5.00', title: 'Paid Item' });

      const freeRes = await request(app).get('/api/items').query({ borrowType: 'FREE' });
      expect(freeRes.body.items).toHaveLength(1);
      expect(freeRes.body.items[0].title).toBe('Free Item');

      const paidRes = await request(app).get('/api/items').query({ borrowType: 'PAID' });
      expect(paidRes.body.items).toHaveLength(1);
      expect(paidRes.body.items[0].title).toBe('Paid Item');
    });
  });

  it('combines category + location + search as AND, not OR', async () => {
    const owner = await registerAndLogin();
    // Matches everything.
    await insertItem({
      ownerId: owner.userId,
      title: 'Casio Calculator',
      category: 'Electronics',
      location: 'Unity Hall',
    });
    // Matches category + search, wrong location.
    await insertItem({
      ownerId: owner.userId,
      title: 'Casio Calculator',
      category: 'Electronics',
      location: 'Republic Hall',
    });
    // Matches location + search, wrong category.
    await insertItem({
      ownerId: owner.userId,
      title: 'Casio Calculator',
      category: 'Academic',
      location: 'Unity Hall',
    });
    // Matches category + location, wrong search.
    await insertItem({ ownerId: owner.userId, title: 'Lab Coat', category: 'Electronics', location: 'Unity Hall' });

    // Each filter alone is broader than the combination.
    const byCategory = await request(app).get('/api/items').query({ category: 'Electronics' });
    expect(byCategory.body.items).toHaveLength(3);
    const byLocation = await request(app).get('/api/items').query({ location: 'Unity Hall' });
    expect(byLocation.body.items).toHaveLength(3);
    const bySearch = await request(app).get('/api/items').query({ search: 'Calculator' });
    expect(bySearch.body.items).toHaveLength(3);

    const combined = await request(app)
      .get('/api/items')
      .query({ category: 'Electronics', location: 'Unity Hall', search: 'Calculator' });

    expect(combined.body.items).toHaveLength(1);
    expect(combined.body.items[0].title).toBe('Casio Calculator');
    expect(combined.body.items[0].category).toBe('Electronics');
    expect(combined.body.items[0].location).toBe('Unity Hall');
  });

  describe('sort', () => {
    it('defaults to newest first', async () => {
      const owner = await registerAndLogin();
      const older = await insertItem({
        ownerId: owner.userId,
        title: 'Older',
        createdAt: new Date('2020-01-01T00:00:00Z'),
      });
      const newer = await insertItem({
        ownerId: owner.userId,
        title: 'Newer',
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });

      const res = await request(app).get('/api/items');

      expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([newer, older]);
    });

    it('price_asc orders cheapest first, with FREE items treated as 0', async () => {
      const owner = await registerAndLogin();
      const free = await insertItem({ ownerId: owner.userId, borrowType: 'FREE', title: 'Free' });
      const cheap = await insertItem({
        ownerId: owner.userId,
        borrowType: 'PAID',
        pricePerDay: '2.00',
        title: 'Cheap',
      });
      const expensive = await insertItem({
        ownerId: owner.userId,
        borrowType: 'PAID',
        pricePerDay: '10.00',
        title: 'Expensive',
      });

      const res = await request(app).get('/api/items').query({ sort: 'price_asc' });

      expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([free, cheap, expensive]);
    });

    it('price_desc orders most expensive first, with FREE items last', async () => {
      const owner = await registerAndLogin();
      const free = await insertItem({ ownerId: owner.userId, borrowType: 'FREE', title: 'Free' });
      const cheap = await insertItem({
        ownerId: owner.userId,
        borrowType: 'PAID',
        pricePerDay: '2.00',
        title: 'Cheap',
      });
      const expensive = await insertItem({
        ownerId: owner.userId,
        borrowType: 'PAID',
        pricePerDay: '10.00',
        title: 'Expensive',
      });

      const res = await request(app).get('/api/items').query({ sort: 'price_desc' });

      expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([expensive, cheap, free]);
    });
  });

  describe('pagination', () => {
    it('page 1 and page 2 return distinct, non-overlapping items, with correct totals', async () => {
      const owner = await registerAndLogin();
      const ids: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        ids.push(await insertItem({ ownerId: owner.userId, title: `Item ${i}` }));
      }

      const page1 = await request(app).get('/api/items').query({ page: 1, limit: 2 });
      const page2 = await request(app).get('/api/items').query({ page: 2, limit: 2 });

      expect(page1.body.items).toHaveLength(2);
      expect(page2.body.items).toHaveLength(2);
      const page1Ids = page1.body.items.map((item: { id: string }) => item.id);
      const page2Ids = page2.body.items.map((item: { id: string }) => item.id);
      expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);

      expect(page1.body.pagination).toEqual({ page: 1, limit: 2, totalItems: 5, totalPages: 3 });
    });

    it('clamps limit at 50 when a larger value is requested', async () => {
      const res = await request(app).get('/api/items').query({ limit: 500 });
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(50);
    });

    it('returns an empty items array for an out-of-range page, not an error', async () => {
      const owner = await registerAndLogin();
      await insertItem({ ownerId: owner.userId });

      const res = await request(app).get('/api/items').query({ page: 999 });

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    });

    it('rejects a non-numeric or negative page/limit with 400', async () => {
      expect((await request(app).get('/api/items').query({ page: 'abc' })).status).toBe(400);
      expect((await request(app).get('/api/items').query({ page: -1 })).status).toBe(400);
      expect((await request(app).get('/api/items').query({ limit: -5 })).status).toBe(400);
    });
  });
});
