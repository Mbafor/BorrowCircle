import { db } from '../../src/config/db';
import { items, passwordResetTokens, refreshTokens, users } from '../../src/db/schema';

export async function clearDatabase(): Promise<void> {
  await db.delete(passwordResetTokens);
  await db.delete(refreshTokens);
  await db.delete(items);
  await db.delete(users);
}

export interface InsertItemOptions {
  ownerId: string;
  title?: string;
  description?: string;
  category?: string;
  location?: string;
  status?: 'AVAILABLE' | 'RESERVED' | 'BORROWED' | 'OVERDUE' | 'PAUSED' | 'CANCELLED' | 'REMOVED';
  borrowType?: 'FREE' | 'PAID';
  pricePerDay?: string | null;
  createdAt?: Date;
}

export async function insertItem(options: InsertItemOptions): Promise<string> {
  const [row] = await db
    .insert(items)
    .values({
      ownerId: options.ownerId,
      title: options.title ?? 'Scientific Calculator',
      description: options.description ?? 'Good condition.',
      category: options.category ?? 'Electronics',
      location: options.location ?? 'Republic Hall',
      borrowType: options.borrowType ?? 'FREE',
      status: options.status ?? 'AVAILABLE',
      ...(options.pricePerDay !== undefined ? { pricePerDay: options.pricePerDay } : {}),
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    })
    .returning();
  return row.id;
}
