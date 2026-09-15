import { and, avg, count, desc, eq, inArray, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../config/db';
import { borrowRequests, items, ratings, users } from '../db/schema';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { createNotification } from './notifications.service';
import { CreateRatingBody } from '../validation/ratings.validation';

export type RatingRow = typeof ratings.$inferSelect;

export interface PublicReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  score: number;
  comment: string | null;
  createdAt: Date;
}

export interface ReviewsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PendingRating {
  borrowRequestId: string;
  itemTitle: string;
  otherParticipantName: string;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === '23505';
}

/**
 * True aggregate over every rating this user has received, rounded to one
 * decimal place before storing. Recomputed from scratch (not an incremental
 * running average) so there's no risk of drift from a missed update.
 */
export function roundAverageRating(average: number): string {
  return (Math.round(average * 10) / 10).toFixed(1);
}

export async function createRating(reviewerId: string, input: CreateRatingBody): Promise<RatingRow> {
  const [request] = await db
    .select()
    .from(borrowRequests)
    .where(eq(borrowRequests.id, input.borrowRequestId))
    .limit(1);
  if (!request) {
    throw new NotFoundError('Borrow request not found');
  }

  const [item] = await db.select().from(items).where(eq(items.id, request.itemId)).limit(1);
  if (!item) {
    throw new NotFoundError('Item not found');
  }

  let revieweeId: string;
  if (reviewerId === request.borrowerId) {
    revieweeId = item.ownerId;
  } else if (reviewerId === item.ownerId) {
    revieweeId = request.borrowerId;
  } else {
    throw new ForbiddenError('You are not a participant in this borrow request');
  }

  // Not reachable through normal flow (reviewer/reviewee are derived from
  // the request's own borrower/owner, which createRequest already forbids
  // being the same person) — kept as a safety net against data inconsistency.
  if (revieweeId === reviewerId) {
    throw new ConflictError('You cannot rate yourself');
  }

  if (request.status !== 'RETURNED') {
    throw new ConflictError(`Cannot rate a request that is ${request.status}`);
  }

  let created: RatingRow;
  try {
    created = await db.transaction(async (tx) => {
      const [insertedRating] = await tx
        .insert(ratings)
        .values({
          borrowRequestId: input.borrowRequestId,
          reviewerId,
          revieweeId,
          score: input.score,
          comment: input.comment ?? null,
        })
        .returning();

      const [avgResult] = await tx
        .select({ value: avg(ratings.score) })
        .from(ratings)
        .where(eq(ratings.revieweeId, revieweeId));
      const newAverage = roundAverageRating(Number(avgResult?.value ?? 0));

      await tx.update(users).set({ averageRating: newAverage }).where(eq(users.id, revieweeId));

      await createNotification(
        {
          userId: revieweeId,
          type: 'RATING_RECEIVED',
          title: 'New rating received',
          message: `You received a new ${input.score}-star rating.`,
          targetType: 'BORROW_REQUEST',
          targetId: input.borrowRequestId,
        },
        tx,
      );

      return insertedRating;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('You have already rated this borrow request');
    }
    throw err;
  }

  return created;
}

export async function getReviewsForUser(
  revieweeId: string,
  filters: { page: number; limit: number },
): Promise<{ reviews: PublicReview[]; pagination: ReviewsPagination }> {
  const whereClause = eq(ratings.revieweeId, revieweeId);
  const offset = (filters.page - 1) * filters.limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: ratings.id,
        reviewerId: ratings.reviewerId,
        reviewerName: users.fullName,
        score: ratings.score,
        comment: ratings.comment,
        createdAt: ratings.createdAt,
      })
      .from(ratings)
      .innerJoin(users, eq(ratings.reviewerId, users.id))
      .where(whereClause)
      .orderBy(desc(ratings.createdAt))
      .limit(filters.limit)
      .offset(offset),
    db.select({ value: count() }).from(ratings).where(whereClause),
  ]);

  const totalItems = Number(totalResult[0]?.value ?? 0);

  return {
    reviews: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filters.limit),
    },
  };
}

export async function getMyPendingRatings(userId: string): Promise<PendingRating[]> {
  const borrowerUser = alias(users, 'borrower_user');
  const ownerUser = alias(users, 'owner_user');

  const rows = await db
    .select({
      requestId: borrowRequests.id,
      itemTitle: items.title,
      borrowerId: borrowRequests.borrowerId,
      ownerId: items.ownerId,
      borrowerName: borrowerUser.fullName,
      ownerName: ownerUser.fullName,
    })
    .from(borrowRequests)
    .innerJoin(items, eq(borrowRequests.itemId, items.id))
    .innerJoin(borrowerUser, eq(borrowRequests.borrowerId, borrowerUser.id))
    .innerJoin(ownerUser, eq(items.ownerId, ownerUser.id))
    .where(
      and(eq(borrowRequests.status, 'RETURNED'), or(eq(borrowRequests.borrowerId, userId), eq(items.ownerId, userId))),
    );

  if (rows.length === 0) {
    return [];
  }

  const requestIds = rows.map((row) => row.requestId);
  const existingRatings = await db
    .select({ borrowRequestId: ratings.borrowRequestId })
    .from(ratings)
    .where(and(eq(ratings.reviewerId, userId), inArray(ratings.borrowRequestId, requestIds)));
  const ratedRequestIds = new Set(existingRatings.map((r) => r.borrowRequestId));

  return rows
    .filter((row) => !ratedRequestIds.has(row.requestId))
    .map((row) => ({
      borrowRequestId: row.requestId,
      itemTitle: row.itemTitle,
      otherParticipantName: row.borrowerId === userId ? row.ownerName : row.borrowerName,
    }));
}
