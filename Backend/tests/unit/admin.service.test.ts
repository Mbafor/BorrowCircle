import { db } from '../../src/config/db';
import { items, users } from '../../src/db/schema';
import { buildAdminItemsWhereClause, buildAdminUsersWhereClause, buildItemStatusCounts } from '../../src/services/admin.service';

// Query *compilation* only (drizzle's .toSQL()), same pattern as
// items.browseQuery.test.ts — a real unit test of the query-building logic,
// not an integration test against a live database.

describe('buildAdminUsersWhereClause', () => {
  it('has no filter (undefined) when nothing is provided — unlike any public endpoint, SUSPENDED/DELETED stay visible', () => {
    const clause = buildAdminUsersWhereClause({});
    expect(clause).toBeUndefined();
  });

  it('filters by status alone', () => {
    const { sql, params } = db.select().from(users).where(buildAdminUsersWhereClause({ status: 'SUSPENDED' })).toSQL();
    expect(sql).toContain('"status" =');
    expect(params).toEqual(['SUSPENDED']);
  });

  it('combines status and search (name/email) with AND', () => {
    const { sql, params } = db
      .select()
      .from(users)
      .where(buildAdminUsersWhereClause({ status: 'ACTIVE', search: 'jane' }))
      .toSQL();
    expect(sql.toLowerCase()).toContain('and');
    expect(sql.toLowerCase()).toContain('ilike');
    expect(params).toEqual(expect.arrayContaining(['ACTIVE', '%jane%']));
  });

  it('search alone produces an OR across full_name and email', () => {
    const { sql, params } = db.select().from(users).where(buildAdminUsersWhereClause({ search: 'knust.edu.gh' })).toSQL();
    expect(sql.toLowerCase()).toContain('or');
    expect(sql.toLowerCase()).toContain('ilike');
    expect(params).toEqual(['%knust.edu.gh%', '%knust.edu.gh%']);
  });
});

describe('buildAdminItemsWhereClause', () => {
  it('has no filter (undefined) when nothing is provided — every status is visible here, unlike Feature 4 browse', () => {
    const clause = buildAdminItemsWhereClause({});
    expect(clause).toBeUndefined();
  });

  it('filters by any status value, including ones public browse would never return', () => {
    const { sql, params } = db.select().from(items).where(buildAdminItemsWhereClause({ status: 'REMOVED' })).toSQL();
    expect(sql).toContain('"status" =');
    expect(params).toEqual(['REMOVED']);
  });

  it('combines status and search (title/description) with AND', () => {
    const { sql, params } = db
      .select()
      .from(items)
      .where(buildAdminItemsWhereClause({ status: 'CANCELLED', search: 'calculator' }))
      .toSQL();
    expect(sql.toLowerCase()).toContain('and');
    expect(sql.toLowerCase()).toContain('ilike');
    expect(params).toEqual(expect.arrayContaining(['CANCELLED', '%calculator%']));
  });
});

describe('buildItemStatusCounts', () => {
  it('defaults every item status to 0 when no rows are given', () => {
    const result = buildItemStatusCounts([]);
    expect(result).toEqual({
      AVAILABLE: 0,
      RESERVED: 0,
      BORROWED: 0,
      OVERDUE: 0,
      PAUSED: 0,
      CANCELLED: 0,
      REMOVED: 0,
    });
  });

  it('overlays given counts onto the 0 defaults, leaving absent statuses at 0', () => {
    const result = buildItemStatusCounts([
      { status: 'AVAILABLE', value: 40 },
      { status: 'REMOVED', value: 1 },
    ]);
    expect(result.AVAILABLE).toBe(40);
    expect(result.REMOVED).toBe(1);
    expect(result.PAUSED).toBe(0);
    expect(result.CANCELLED).toBe(0);
  });

  it('coerces string counts (as Postgres COUNT returns) to numbers', () => {
    const result = buildItemStatusCounts([{ status: 'BORROWED', value: '12' }]);
    expect(result.BORROWED).toBe(12);
    expect(typeof result.BORROWED).toBe('number');
  });
});
