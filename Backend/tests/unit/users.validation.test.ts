import { updateProfileSchema } from '../../src/validation/users.validation';

describe('updateProfileSchema', () => {
  it('accepts a partial valid update', () => {
    const result = updateProfileSchema.safeParse({ fullName: 'New Name', bio: 'Hello there' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts every value in the fixed location list', () => {
    const result = updateProfileSchema.safeParse({ location: 'Unity Hall' });
    expect(result.success).toBe(true);
  });

  it('rejects a location outside the fixed list', () => {
    const result = updateProfileSchema.safeParse({ location: 'Some Random Place' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid phone number format', () => {
    const result = updateProfileSchema.safeParse({ phoneNumber: '12345' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid Ghanaian phone number', () => {
    const result = updateProfileSchema.safeParse({ phoneNumber: '0241234567' });
    expect(result.success).toBe(true);
  });

  it('rejects a bio over 500 characters', () => {
    const result = updateProfileSchema.safeParse({ bio: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('allows clearing bio and profileImageUrl with null', () => {
    const result = updateProfileSchema.safeParse({ bio: null, profileImageUrl: null });
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields', () => {
    const result = updateProfileSchema.safeParse({ role: 'ADMIN' });
    expect(result.success).toBe(false);
  });
});
