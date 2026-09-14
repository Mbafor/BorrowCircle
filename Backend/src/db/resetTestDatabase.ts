import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import path from 'path';
import { env, isTest } from '../config/env';

export async function resetTestDatabase(): Promise<void> {
  if (!isTest) {
    throw new Error('resetTestDatabase must only be run with NODE_ENV=test');
  }

  const pool = new Pool({ connectionString: env.databaseUrl });

  try {
    // Drizzle's migration tracker lives in its own "drizzle" schema, which
    // survives dropping "public" — drop it too or migrate() thinks every
    // migration already ran and silently skips recreating the tables.
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.resolve(__dirname, 'migrations') });
  } finally {
    await pool.end();
  }
}
