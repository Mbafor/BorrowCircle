// Plain JS (not TS): Jest's globalSetup runs outside the ts-jest transform
// pipeline, so this file is loaded directly by Node. Its logic mirrors
// src/db/resetTestDatabase.ts, which the `test:db:reset` script uses instead.
const path = require('path');

process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test') });

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');

module.exports = async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set for the test environment (Backend/.env.test)');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    // Drizzle's migration tracker lives in its own "drizzle" schema, which
    // survives dropping "public" — drop it too or migrate() thinks every
    // migration already ran and silently skips recreating the tables.
    await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../src/db/migrations') });
  } finally {
    await pool.end();
  }
};
