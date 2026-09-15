import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
}

export function generateRandomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generates a short numeric handover code (e.g. "042917"), meant to be read
 * aloud or shown on a phone screen during a face-to-face pickup/return, not
 * typed from a link — hence short digits instead of a long hex token.
 */
export function generateHandoverCode(digits = 6): string {
  const max = 10 ** digits;
  return crypto.randomInt(0, max).toString().padStart(digits, '0');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export interface SignedAccessToken {
  token: string;
  expiresAt: Date;
}

export function signAccessToken(userId: string): SignedAccessToken {
  const options: jwt.SignOptions = { expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'] };
  const token = jwt.sign({ sub: userId }, env.jwtAccessSecret, options);
  // Decoding our own freshly-signed token for its `exp` claim (rather than
  // re-parsing the "15m"-style duration string) keeps the cookie's expiry
  // guaranteed to match whatever jsonwebtoken actually encoded.
  const decoded = jwt.decode(token) as { exp: number };
  return { token, expiresAt: new Date(decoded.exp * 1000) };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtAccessSecret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new jwt.JsonWebTokenError('Malformed access token payload');
  }
  return { sub: decoded.sub };
}
