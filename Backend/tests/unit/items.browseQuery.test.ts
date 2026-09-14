import { db } from '../../src/config/db';
import { items } from '../../src/db/schema';
import { buildBrowseOrderBy, buildBrowseWhereClause } from '../../src/services/items.service';

// These exercise query *compilation* only (drizzle's .toSQL()), which never
// touches the network — a real unit test of the query-building logic, not
// an integration test against a live database.

describe('buildBrowseWhereClause', () => {
  it('always filters to AVAILABLE items, even with no other filters', () => {
    const { sql, params } = db.select().from(items).where(buildBrowseWhereClause({})).toSQL();
    expect(sql).toContain('"status" =');
    expect(params).toContain('AVAILABLE');
  });

  it('combines category, location, borrowType, and search with AND', () => {
    const clause = buildBrowseWhereClause({
      category: 'Electronics',
      location: 'Unity Hall',
      borrowType: 'PAID',
      search: 'calculator',
    });
    const { sql, params } = db.select().from(items).where(clause).toSQL();

    expect(sql).toContain('"status" = $1 and "items"."category" = $2');
    expect(sql).toContain('"items"."location" = $3 and "items"."borrow_type" = $4');
    expect(sql.toLowerCase()).toContain('ilike');
    expect(params).toEqual(expect.arrayContaining(['AVAILABLE', 'Electronics', 'Unity Hall', 'PAID', '%calculator%']));
  });

  it('does not add an ILIKE clause when no search term is given', () => {
    const { sql } = db.select().from(items).where(buildBrowseWhereClause({ category: 'Academic' })).toSQL();
    expect(sql.toLowerCase()).not.toContain('ilike');
  });
});

describe('buildBrowseOrderBy', () => {
  it('defaults (newest) to created_at descending', () => {
    const { sql } = db.select().from(items).orderBy(buildBrowseOrderBy('newest')).toSQL();
    expect(sql.trim().endsWith('"items"."created_at" desc')).toBe(true);
  });

  it('price_asc sorts by COALESCE(price_per_day, 0) ascending', () => {
    const { sql } = db.select().from(items).orderBy(buildBrowseOrderBy('price_asc')).toSQL();
    expect(sql.toLowerCase()).toContain('coalesce');
    expect(sql.toLowerCase()).toContain('price_per_day');
    expect(sql.trim().endsWith('asc')).toBe(true);
  });

  it('price_desc sorts by COALESCE(price_per_day, 0) descending', () => {
    const { sql } = db.select().from(items).orderBy(buildBrowseOrderBy('price_desc')).toSQL();
    expect(sql.toLowerCase()).toContain('coalesce');
    expect(sql.trim().endsWith('desc')).toBe(true);
  });
});
