import { and, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { users, refreshTokens, passwordResetTokens } from '../db/schema';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/passwordHash';
import { generateRandomToken, hashToken, signAccessToken } from '../utils/token';
import { sendPasswordResetEmail } from './email';

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  location: string;
  phoneNumber: string;
}

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  location: string;
  profileImageUrl: string | null;
  bio: string | null;
  averageRating: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: Date;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    location: user.location,
    profileImageUrl: user.profileImageUrl,
    bio: user.bio,
    averageRating: user.averageRating,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export function isAllowedEmailDomain(email: string): boolean {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return false;
  }
  const domain = email.slice(atIndex + 1).toLowerCase();
  return env.allowedEmailDomains.includes(domain);
}

async function issueSession(userId: string): Promise<Session> {
  const accessToken = signAccessToken(userId);
  const rawRefreshToken = generateRandomToken();
  const refreshTokenExpiresAt = new Date(
    Date.now() + env.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000,
  );

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(rawRefreshToken),
    expiresAt: refreshTokenExpiresAt,
  });

  return { accessToken, refreshToken: rawRefreshToken, refreshTokenExpiresAt };
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const [existingEmail] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existingEmail) {
    throw new ConflictError('An account with this email already exists');
  }

  const [existingPhone] = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, input.phoneNumber))
    .limit(1);
  if (existingPhone) {
    throw new ConflictError('An account with this phone number already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const [created] = await db
    .insert(users)
    .values({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      phoneNumber: input.phoneNumber,
      location: input.location,
    })
    .returning();

  return toPublicUser(created);
}

export async function loginUser(email: string, password: string): Promise<{ user: PublicUser; session: Session }> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const session = await issueSession(user.id);
  return { user: toPublicUser(user), session };
}

export async function logoutUser(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}

async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

export async function refreshSession(rawRefreshToken: string): Promise<Session> {
  const tokenHash = hashToken(rawRefreshToken);
  const [existing] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!existing || existing.revokedAt || existing.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, existing.id));

  return issueSession(existing.userId);
}

export async function getUserProfile(userId: string): Promise<PublicUser> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return toPublicUser(user);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return;
  }

  const rawToken = generateRandomToken();
  const expiresAt = new Date(Date.now() + env.passwordResetExpiresInMinutes * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  const resetLink = `${env.frontendUrl}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetLink);
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const [tokenRow] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    throw new UnauthorizedError('Invalid or expired reset token');
  }

  const passwordHash = await hashPassword(newPassword);

  await db.update(users).set({ passwordHash }).where(eq(users.id, tokenRow.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenRow.id));
  await revokeAllUserRefreshTokens(tokenRow.userId);
}
