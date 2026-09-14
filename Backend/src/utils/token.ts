import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
}

export function generateRandomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function signAccessToken(userId: string): string {
  const options: jwt.SignOptions = { expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId }, env.jwtAccessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.jwtAccessSecret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new jwt.JsonWebTokenError('Malformed access token payload');
  }
  return { sub: decoded.sub };
}
