import { resetTestDatabase } from '../src/db/resetTestDatabase';

resetTestDatabase()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('Test database reset and migrated.');
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to reset test database:', err);
    process.exit(1);
  });
