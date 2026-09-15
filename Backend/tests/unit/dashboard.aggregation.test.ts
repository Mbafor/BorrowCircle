import { pickMostRecentRequestPerItem } from '../../src/services/dashboard.service';

interface FakeRow {
  itemId: string;
  status: 'PENDING' | 'ACCEPTED' | 'BORROWED' | 'OVERDUE';
  label: string;
}

describe('pickMostRecentRequestPerItem', () => {
  it('returns an empty result for no rows', () => {
    const { mostRecentByItem, pendingCountByItem } = pickMostRecentRequestPerItem<FakeRow>([]);
    expect(mostRecentByItem.size).toBe(0);
    expect(pendingCountByItem.size).toBe(0);
  });

  it('picks the first row per item, assuming input is already newest-first', () => {
    const rows: FakeRow[] = [
      { itemId: 'item-1', status: 'PENDING', label: 'newest' },
      { itemId: 'item-1', status: 'PENDING', label: 'older' },
    ];
    const { mostRecentByItem } = pickMostRecentRequestPerItem(rows);
    expect(mostRecentByItem.get('item-1')?.label).toBe('newest');
  });

  it('counts only PENDING rows per item, ignoring other non-terminal statuses', () => {
    const rows: FakeRow[] = [
      { itemId: 'item-1', status: 'PENDING', label: 'a' },
      { itemId: 'item-1', status: 'PENDING', label: 'b' },
      { itemId: 'item-1', status: 'PENDING', label: 'c' },
    ];
    const { pendingCountByItem } = pickMostRecentRequestPerItem(rows);
    expect(pendingCountByItem.get('item-1')).toBe(3);
  });

  it('an ACCEPTED/BORROWED/OVERDUE request is embedded but not counted as pending', () => {
    const rows: FakeRow[] = [{ itemId: 'item-1', status: 'ACCEPTED', label: 'accepted' }];
    const { mostRecentByItem, pendingCountByItem } = pickMostRecentRequestPerItem(rows);
    expect(mostRecentByItem.get('item-1')?.label).toBe('accepted');
    expect(pendingCountByItem.get('item-1')).toBeUndefined();
  });

  it('keeps items independent of each other', () => {
    const rows: FakeRow[] = [
      { itemId: 'item-1', status: 'PENDING', label: 'item1-req' },
      { itemId: 'item-2', status: 'ACCEPTED', label: 'item2-req' },
    ];
    const { mostRecentByItem, pendingCountByItem } = pickMostRecentRequestPerItem(rows);
    expect(mostRecentByItem.get('item-1')?.label).toBe('item1-req');
    expect(mostRecentByItem.get('item-2')?.label).toBe('item2-req');
    expect(pendingCountByItem.get('item-1')).toBe(1);
    expect(pendingCountByItem.get('item-2')).toBeUndefined();
  });
});
