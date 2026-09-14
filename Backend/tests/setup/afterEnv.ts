import { pool } from '../../src/config/db';

afterAll(async () => {
  await pool.end();
});
