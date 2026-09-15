import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from './env';
import * as schema from '../db/schema';

export const pool = new Pool({ connectionString: env.databaseUrl });

export const db = drizzle(pool, { schema });

// The type of the transaction client passed into db.transaction(async (tx) => ...),
// derived generically so it always matches whatever drizzle-orm actually
// hands back rather than a hand-typed guess. Shared by services that need to
// participate in a transaction started by another service (e.g. items.service
// cascading into requests.service during an item cancellation).
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
