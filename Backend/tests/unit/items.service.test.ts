import { isEditableStatus, isValidStatusTransition, validatePriceUpdate } from '../../src/services/items.service';

describe('isValidStatusTransition', () => {
  it('allows AVAILABLE -> PAUSED', () => {
    expect(isValidStatusTransition('AVAILABLE', 'PAUSED')).toBe(true);
  });

  it('allows PAUSED -> AVAILABLE', () => {
    expect(isValidStatusTransition('PAUSED', 'AVAILABLE')).toBe(true);
  });

  it('allows AVAILABLE -> CANCELLED', () => {
    expect(isValidStatusTransition('AVAILABLE', 'CANCELLED')).toBe(true);
  });

  it('allows PAUSED -> CANCELLED', () => {
    expect(isValidStatusTransition('PAUSED', 'CANCELLED')).toBe(true);
  });

  it('rejects CANCELLED -> AVAILABLE (terminal state)', () => {
    expect(isValidStatusTransition('CANCELLED', 'AVAILABLE')).toBe(false);
  });

  it('rejects transitions out of RESERVED/BORROWED/OVERDUE via this endpoint', () => {
    expect(isValidStatusTransition('RESERVED', 'PAUSED')).toBe(false);
    expect(isValidStatusTransition('BORROWED', 'CANCELLED')).toBe(false);
    expect(isValidStatusTransition('OVERDUE', 'AVAILABLE')).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(isValidStatusTransition('AVAILABLE', 'AVAILABLE')).toBe(false);
    expect(isValidStatusTransition('PAUSED', 'PAUSED')).toBe(false);
  });
});

describe('isEditableStatus', () => {
  it('allows editing while AVAILABLE or PAUSED', () => {
    expect(isEditableStatus('AVAILABLE')).toBe(true);
    expect(isEditableStatus('PAUSED')).toBe(true);
  });

  it('blocks editing while RESERVED, BORROWED, OVERDUE, or CANCELLED', () => {
    expect(isEditableStatus('RESERVED')).toBe(false);
    expect(isEditableStatus('BORROWED')).toBe(false);
    expect(isEditableStatus('OVERDUE')).toBe(false);
    expect(isEditableStatus('CANCELLED')).toBe(false);
  });
});

describe('validatePriceUpdate', () => {
  it('allows no price change (undefined)', () => {
    expect(validatePriceUpdate('PAID', undefined)).toBeNull();
    expect(validatePriceUpdate('FREE', undefined)).toBeNull();
  });

  it('allows setting a new price on a PAID item', () => {
    expect(validatePriceUpdate('PAID', 10)).toBeNull();
  });

  it('rejects clearing the price on a PAID item', () => {
    expect(validatePriceUpdate('PAID', null)).toBe('Price per day is required for a paid item');
  });

  it('rejects setting a price on a FREE item', () => {
    expect(validatePriceUpdate('FREE', 5)).toBe('A free item cannot have a price');
  });

  it('allows explicitly clearing the price on a FREE item (no-op)', () => {
    expect(validatePriceUpdate('FREE', null)).toBeNull();
  });
});
