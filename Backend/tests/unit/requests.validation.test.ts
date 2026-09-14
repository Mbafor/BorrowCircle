import { createRequestSchema } from '../../src/validation/requests.validation';

const VALID_ITEM_ID = '11111111-1111-1111-1111-111111111111';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    itemId: VALID_ITEM_ID,
    pickupDate: futureDate(1),
    returnDate: futureDate(3),
    ...overrides,
  };
}

describe('createRequestSchema', () => {
  it('accepts a valid request with a future pickup/return date', () => {
    expect(createRequestSchema.safeParse(validPayload()).success).toBe(true);
  });

  it('accepts an optional message', () => {
    const result = createRequestSchema.safeParse(validPayload({ message: 'Please handle with care' }));
    expect(result.success).toBe(true);
  });

  it('accepts today as a valid pickup date (not in the past)', () => {
    const result = createRequestSchema.safeParse(validPayload({ pickupDate: futureDate(0), returnDate: futureDate(2) }));
    expect(result.success).toBe(true);
  });

  it('rejects a pickup date in the past', () => {
    const result = createRequestSchema.safeParse(validPayload({ pickupDate: futureDate(-1) }));
    expect(result.success).toBe(false);
  });

  it('rejects a return date equal to the pickup date', () => {
    const same = futureDate(2);
    const result = createRequestSchema.safeParse(validPayload({ pickupDate: same, returnDate: same }));
    expect(result.success).toBe(false);
  });

  it('rejects a return date before the pickup date', () => {
    const result = createRequestSchema.safeParse(validPayload({ pickupDate: futureDate(5), returnDate: futureDate(2) }));
    expect(result.success).toBe(false);
  });

  it('rejects an invalid itemId format', () => {
    const result = createRequestSchema.safeParse(validPayload({ itemId: 'not-a-uuid' }));
    expect(result.success).toBe(false);
  });

  it('rejects a malformed date string', () => {
    const result = createRequestSchema.safeParse(validPayload({ pickupDate: '01/02/2030' }));
    expect(result.success).toBe(false);
  });

  it('rejects a message over 500 characters', () => {
    const result = createRequestSchema.safeParse(validPayload({ message: 'a'.repeat(501) }));
    expect(result.success).toBe(false);
  });

  it('rejects a missing itemId', () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).itemId;
    expect(createRequestSchema.safeParse(payload).success).toBe(false);
  });
});
