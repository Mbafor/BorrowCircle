import { and, eq, inArray, isNull, ne, notInArray } from 'drizzle-orm';
import { db, DbTransaction } from '../config/db';
import { items, refreshTokens, users } from '../db/schema';
import { ConflictError, NotFoundError } from '../utils/errors';
import { createNotification } from './notifications.service';

export type UserRow = typeof users.$inferSelect;

export interface ProfileItem {
  id: string;
  title: string;
  category: string;
  location: string;
  borrowType: 'FREE' | 'PAID';
  pricePerDay: string | null;
  status: string;
  imageUrls: string[] | null;
  createdAt: Date;
}

export interface Profile {
  id: string;
  fullName: string;
  location: string;
  profileImageUrl: string | null;
  bio: string | null;
  averageRating: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: Date;
  phoneNumber?: string;
  items: ProfileItem[];
}

export interface UpdateProfileInput {
  fullName?: string;
  phoneNumber?: string;
  location?: string;
  bio?: string | null;
  profileImageUrl?: string | null;
}

const RESERVING_ITEM_STATUSES = ['RESERVED', 'BORROWED'] as const;
const PUBLIC_ITEM_STATUSES = ['AVAILABLE', 'PAUSED'] as const;

function toProfileItem(item: typeof items.$inferSelect): ProfileItem {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    location: item.location,
    borrowType: item.borrowType,
    pricePerDay: item.pricePerDay,
    status: item.status,
    imageUrls: item.imageUrls,
    createdAt: item.createdAt,
  };
}

async function getItemsForOwner(ownerId: string, options: { excludeCancelled?: boolean } = {}): Promise<ProfileItem[]> {
  const condition = options.excludeCancelled
    ? and(eq(items.ownerId, ownerId), notInArray(items.status, ['CANCELLED']))
    : eq(items.ownerId, ownerId);
  const rows = await db.select().from(items).where(condition);
  return rows.map(toProfileItem);
}

function toProfile(user: typeof users.$inferSelect, ownedItems: ProfileItem[], includePhone: boolean): Profile {
  return {
    id: user.id,
    fullName: user.fullName,
    location: user.location,
    profileImageUrl: user.profileImageUrl,
    bio: user.bio,
    averageRating: user.averageRating,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    ...(includePhone ? { phoneNumber: user.phoneNumber } : {}),
    items: ownedItems,
  };
}

export async function getOwnProfile(userId: string): Promise<Profile> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  const ownedItems = await getItemsForOwner(userId);
  return toProfile(user, ownedItems, true);
}

// TODO(borrow-requests): a viewer who has an ACCEPTED borrow request with this
// user should also see the phone number. Until the borrow_requests table and
// its status transitions exist, the phone number is always hidden here.
export async function getPublicProfile(userId: string): Promise<Profile> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  const ownedItems = await getItemsForOwner(userId, { excludeCancelled: true });
  return toProfile(user, ownedItems, false);
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
  if (input.phoneNumber) {
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.phoneNumber, input.phoneNumber), ne(users.id, userId)))
      .limit(1);
    if (existing) {
      throw new ConflictError('This phone number is already in use by another account');
    }
  }

  const [updated] = await db.update(users).set(input).where(eq(users.id, userId)).returning();
  if (!updated) {
    throw new NotFoundError('User not found');
  }

  const ownedItems = await getItemsForOwner(userId);
  return toProfile(updated, ownedItems, true);
}

export async function updateProfilePhoto(userId: string, profileImageUrl: string): Promise<Profile> {
  return updateProfile(userId, { profileImageUrl });
}

async function assertCanDeleteAccount(userId: string): Promise<void> {
  const [blockingItem] = await db
    .select()
    .from(items)
    .where(and(eq(items.ownerId, userId), inArray(items.status, [...RESERVING_ITEM_STATUSES])))
    .limit(1);

  if (blockingItem) {
    throw new ConflictError(
      'You have an item that is currently reserved or borrowed. Resolve that before deleting your account.',
    );
  }

  // TODO(borrow-requests): also block deletion if this user has any PENDING or
  // ACCEPTED borrow request as a borrower, once the borrow_requests table exists.
}

export async function deleteAccount(userId: string): Promise<void> {
  await assertCanDeleteAccount(userId);

  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await tx
      .update(users)
      .set({ status: 'DELETED', fullName: 'Deleted User', bio: null, profileImageUrl: null })
      .where(eq(users.id, userId));

    await tx
      .update(items)
      .set({ status: 'CANCELLED' })
      .where(and(eq(items.ownerId, userId), inArray(items.status, [...PUBLIC_ITEM_STATUSES])));

    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  });
}

/**
 * Admin suspension — called both from services/reports.service.ts (a
 * USER-targeted report is upheld, passing the report's reason) and directly
 * from services/admin.service.ts (an admin acts with no report involved).
 * Accepts an optional transaction client so it can be combined atomically
 * with marking a triggering report REVIEWED; standalone callers can omit it.
 * Rejects a user who is already SUSPENDED or DELETED (DELETED is terminal).
 */
export async function suspendUser(
  userId: string,
  reason: string,
  tx: DbTransaction | typeof db = db,
): Promise<UserRow> {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  if (user.status !== 'ACTIVE') {
    throw new ConflictError(`Cannot suspend a user with status ${user.status}`);
  }

  const [updated] = await tx.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, userId)).returning();

  await createNotification(
    {
      userId,
      type: 'ACCOUNT_SUSPENDED',
      title: 'Account suspended',
      message: `Your account has been suspended: ${reason}`,
      targetType: 'USER',
      targetId: userId,
    },
    tx,
  );

  return updated;
}

/**
 * Reverses a suspension. Only reachable from SUSPENDED — an ACTIVE user has
 * nothing to reactivate, and DELETED is terminal per Feature 2 (deleteAccount)
 * and must never be reinstated through this path.
 */
export async function reactivateUser(userId: string, tx: DbTransaction | typeof db = db): Promise<UserRow> {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  if (user.status !== 'SUSPENDED') {
    throw new ConflictError(`Cannot reactivate a user with status ${user.status}`);
  }

  const [updated] = await tx.update(users).set({ status: 'ACTIVE' }).where(eq(users.id, userId)).returning();
  return updated;
}
