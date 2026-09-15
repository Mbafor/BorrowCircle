import jwt from 'jsonwebtoken';
import { isAllowedEmailDomain } from '../../src/services/auth.service';
import { hashPassword, verifyPassword } from '../../src/utils/passwordHash';
import { generateRandomToken, hashToken, signAccessToken, verifyAccessToken } from '../../src/utils/token';
import { env } from '../../src/config/env';

describe('passwordHash', () => {
  it('hashes a password to a value different from the plaintext', async () => {
    const hash = await hashPassword('Str0ngPass!');
    expect(hash).not.toBe('Str0ngPass!');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('Str0ngPass!');
    await expect(verifyPassword('Str0ngPass!', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hash = await hashPassword('Str0ngPass!');
    await expect(verifyPassword('WrongPass!', hash)).resolves.toBe(false);
  });
});

describe('token utils', () => {
  it('generates random tokens of the expected length that differ each call', () => {
    const a = generateRandomToken();
    const b = generateRandomToken();
    expect(a).toHaveLength(96); // 48 bytes -> 96 hex chars
    expect(a).not.toBe(b);
  });

  it('hashes tokens deterministically', () => {
    const token = generateRandomToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashToken(generateRandomToken())).not.toBe(hashToken(generateRandomToken()));
  });

  it('signs and verifies an access token round trip', () => {
    const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const { token, expiresAt } = signAccessToken(userId);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(userId);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a garbage access token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow();
  });

  it('rejects an expired access token', () => {
    const expired = jwt.sign({ sub: 'user-1' }, env.jwtAccessSecret, { expiresIn: '-10s' });
    expect(() => verifyAccessToken(expired)).toThrow();
  });
});

describe('isAllowedEmailDomain', () => {
  it('accepts an email on the configured university domain', () => {
    expect(isAllowedEmailDomain('student@st.knust.edu.gh')).toBe(true);
  });

  it('is case-insensitive on the domain', () => {
    expect(isAllowedEmailDomain('Student@ST.KNUST.EDU.GH')).toBe(true);
  });

  it('rejects an email on a different domain', () => {
    expect(isAllowedEmailDomain('student@gmail.com')).toBe(false);
  });

  it('rejects the bare parent domain when the subdomain is required', () => {
    expect(isAllowedEmailDomain('student@knust.edu.gh')).toBe(false);
  });

  it('rejects a malformed email with no domain', () => {
    expect(isAllowedEmailDomain('not-an-email')).toBe(false);
  });
});
