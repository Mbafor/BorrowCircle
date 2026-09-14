import { createItemSchema, updateItemStatusSchema } from '../../src/validation/items.validation';

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: 'Scientific Calculator',
    description: 'Good condition, suitable for engineering courses.',
    category: 'Electronics',
    location: 'Unity Hall',
    borrowType: 'FREE',
    ...overrides,
  };
}

describe('createItemSchema', () => {
  it('accepts a valid FREE listing with no price', () => {
    const result = createItemSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('accepts a valid PAID listing with a price', () => {
    const result = createItemSchema.safeParse(validPayload({ borrowType: 'PAID', pricePerDay: 5 }));
    expect(result.success).toBe(true);
  });

  it('rejects PAID with no price', () => {
    const result = createItemSchema.safeParse(validPayload({ borrowType: 'PAID' }));
    expect(result.success).toBe(false);
  });

  it('rejects PAID with a zero or negative price', () => {
    expect(createItemSchema.safeParse(validPayload({ borrowType: 'PAID', pricePerDay: 0 })).success).toBe(false);
    expect(createItemSchema.safeParse(validPayload({ borrowType: 'PAID', pricePerDay: -5 })).success).toBe(false);
  });

  it('rejects FREE with a price set', () => {
    const result = createItemSchema.safeParse(validPayload({ pricePerDay: 5 }));
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = createItemSchema.safeParse(validPayload({ category: 'Furniture' }));
    expect(result.success).toBe(false);
  });

  it('rejects an invalid location', () => {
    const result = createItemSchema.safeParse(validPayload({ location: 'Nowhere' }));
    expect(result.success).toBe(false);
  });

  it('rejects a missing title', () => {
    const payload = validPayload();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload as any).title;
    expect(createItemSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a missing description', () => {
    const payload = validPayload();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload as any).description;
    expect(createItemSchema.safeParse(payload).success).toBe(false);
  });
});

describe('updateItemStatusSchema', () => {
  it('accepts PAUSED, AVAILABLE, and CANCELLED', () => {
    expect(updateItemStatusSchema.safeParse({ status: 'PAUSED' }).success).toBe(true);
    expect(updateItemStatusSchema.safeParse({ status: 'AVAILABLE' }).success).toBe(true);
    expect(updateItemStatusSchema.safeParse({ status: 'CANCELLED' }).success).toBe(true);
  });

  it('rejects a system-managed status', () => {
    expect(updateItemStatusSchema.safeParse({ status: 'RESERVED' }).success).toBe(false);
    expect(updateItemStatusSchema.safeParse({ status: 'BORROWED' }).success).toBe(false);
    expect(updateItemStatusSchema.safeParse({ status: 'OVERDUE' }).success).toBe(false);
  });

  it('rejects a nonsense value', () => {
    expect(updateItemStatusSchema.safeParse({ status: 'WHATEVER' }).success).toBe(false);
  });
});
