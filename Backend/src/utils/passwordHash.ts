import bcrypt from 'bcryptjs';
import { env } from '../config/env';

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, env.bcryptSaltRounds);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
