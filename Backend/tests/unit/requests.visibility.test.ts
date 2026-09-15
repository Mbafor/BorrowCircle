import { BorrowRequestRow, toBorrowerView, toOwnerView } from '../../src/services/requests.service';

function fakeRequest(overrides: Partial<BorrowRequestRow> = {}): BorrowRequestRow {
  return {
    id: 'req-1',
    itemId: 'item-1',
    borrowerId: 'borrower-1',
    pickupDate: '2030-01-01',
    returnDate: '2030-01-05',
    message: null,
    pickupCode: '123456',
    returnCode: '654321',
    status: 'BORROWED',
    declineReason: null,
    expiresAt: new Date(),
    createdAt: new Date(),
    lastOverdueNotifiedAt: null,
    returnedAt: null,
    ...overrides,
  };
}

describe('toBorrowerView', () => {
  it('nulls out returnCode', () => {
    const view = toBorrowerView(fakeRequest());
    expect(view.returnCode).toBeNull();
  });

  it('keeps pickupCode visible', () => {
    const view = toBorrowerView(fakeRequest());
    expect(view.pickupCode).toBe('123456');
  });

  it('leaves returnCode as null (not omitted) when it was already null', () => {
    const view = toBorrowerView(fakeRequest({ returnCode: null }));
    expect(view.returnCode).toBeNull();
    expect('returnCode' in view).toBe(true);
  });

  it('does not mutate every other field', () => {
    const original = fakeRequest();
    const view = toBorrowerView(original);
    expect(view.id).toBe(original.id);
    expect(view.status).toBe(original.status);
  });
});

describe('toOwnerView', () => {
  it('nulls out pickupCode', () => {
    const view = toOwnerView(fakeRequest());
    expect(view.pickupCode).toBeNull();
  });

  it('keeps returnCode visible', () => {
    const view = toOwnerView(fakeRequest());
    expect(view.returnCode).toBe('654321');
  });

  it('leaves pickupCode as null (not omitted) when it was already null', () => {
    const view = toOwnerView(fakeRequest({ pickupCode: null }));
    expect(view.pickupCode).toBeNull();
    expect('pickupCode' in view).toBe(true);
  });
});
