import { eq } from 'drizzle-orm';
import { db, pool } from '../src/config/db';
import { users } from '../src/db/schema';

function parseEmailArg(): string {
  const prefixed = process.argv.find((arg) => arg.startsWith('--email='));
  const email = prefixed?.slice('--email='.length).trim().toLowerCase();
  if (!email) {
    throw new Error('Usage: npm run seed:admin -- --email=<user-email>');
  }
  return email;
}

async function main(): Promise<void> {
  const email = parseEmailArg();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new Error(`No user found with email "${email}" — nothing was changed.`);
  }

  if (user.role === 'ADMIN') {
    // eslint-disable-next-line no-console
    console.log(`${email} is already an admin — nothing to do.`);
    return;
  }

  await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, user.id));
  // eslint-disable-next-line no-console
  console.log(`Promoted ${email} to ADMIN.`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    await pool.end();
    process.exit(1);
  });
