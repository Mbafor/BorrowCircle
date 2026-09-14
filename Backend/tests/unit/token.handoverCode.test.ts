import { generateHandoverCode } from '../../src/utils/token';

describe('generateHandoverCode', () => {
  it('generates a 6-digit numeric string by default', () => {
    const code = generateHandoverCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('zero-pads short numbers to the full digit length', () => {
    // Statistically near-certain to hit a code starting with 0 across many tries.
    const codes = Array.from({ length: 500 }, () => generateHandoverCode());
    expect(codes.some((c) => c.length === 6)).toBe(true);
    expect(codes.every((c) => c.length === 6)).toBe(true);
  });

  it('generates different codes across calls (not a fixed value)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateHandoverCode()));
    expect(codes.size).toBeGreaterThan(1);
  });

  it('respects a custom digit count', () => {
    const code = generateHandoverCode(4);
    expect(code).toMatch(/^\d{4}$/);
  });
});
