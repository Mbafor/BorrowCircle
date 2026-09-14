import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from './env';
import * as schema from '../db/schema';

export const pool = new Pool({ connectionString: env.databaseUrl });

export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
