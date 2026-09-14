import { isActionableStatus, isCancellableStatus, isReturnableStatus } from '../../src/services/requests.service';

describe('isCancellableStatus', () => {
  it('allows cancelling while PENDING or ACCEPTED', () => {
    expect(isCancellableStatus('PENDING')).toBe(true);
    expect(isCancellableStatus('ACCEPTED')).toBe(true);
  });

  it('blocks cancelling for every other status', () => {
    expect(isCancellableStatus('DECLINED')).toBe(false);
    expect(isCancellableStatus('EXPIRED')).toBe(false);
    expect(isCancellableStatus('CANCELLED')).toBe(false);
    expect(isCancellableStatus('BORROWED')).toBe(false);
    expect(isCancellableStatus('RETURNED')).toBe(false);
    expect(isCancellableStatus('OVERDUE')).toBe(false);
  });
});

describe('isActionableStatus (accept/decline eligibility)', () => {
  it('allows accept/decline only while PENDING', () => {
    expect(isActionableStatus('PENDING')).toBe(true);
  });

  it('blocks accept/decline for every other status', () => {
    expect(isActionableStatus('ACCEPTED')).toBe(false);
    expect(isActionableStatus('DECLINED')).toBe(false);
    expect(isActionableStatus('EXPIRED')).toBe(false);
    expect(isActionableStatus('CANCELLED')).toBe(false);
    expect(isActionableStatus('BORROWED')).toBe(false);
    expect(isActionableStatus('RETURNED')).toBe(false);
    expect(isActionableStatus('OVERDUE')).toBe(false);
  });
});

describe('isReturnableStatus (confirm-return eligibility)', () => {
  it('allows confirming return while BORROWED or OVERDUE', () => {
    expect(isReturnableStatus('BORROWED')).toBe(true);
    expect(isReturnableStatus('OVERDUE')).toBe(true);
  });

  it('blocks confirming return for every other status', () => {
    expect(isReturnableStatus('PENDING')).toBe(false);
    expect(isReturnableStatus('ACCEPTED')).toBe(false);
    expect(isReturnableStatus('DECLINED')).toBe(false);
    expect(isReturnableStatus('EXPIRED')).toBe(false);
    expect(isReturnableStatus('CANCELLED')).toBe(false);
    expect(isReturnableStatus('RETURNED')).toBe(false);
  });
});
