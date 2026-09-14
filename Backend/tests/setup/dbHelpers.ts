import { db } from '../../src/config/db';
import { passwordResetTokens, refreshTokens, users } from '../../src/db/schema';

export async function clearDatabase(): Promise<void> {
  await db.delete(passwordResetTokens);
  await db.delete(refreshTokens);
  await db.delete(users);
}
