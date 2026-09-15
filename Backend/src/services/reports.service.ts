import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { items, reports, users } from '../db/schema';
import { ConflictError, NotFoundError } from '../utils/errors';
import * as itemsService from './items.service';
import * as usersService from './users.service';
import { CreateReportBody, ReportsQuery } from '../validation/reports.validation';

export type ReportRow = typeof reports.$inferSelect;
export type ReportTargetType = ReportRow['targetType'];
export type ReportStatus = ReportRow['status'];

export interface ReportsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === '23505';
}

async function assertTargetExists(targetType: ReportTargetType, targetId: string): Promise<void> {
  if (targetType === 'ITEM') {
    const [item] = await db.select({ id: items.id }).from(items).where(eq(items.id, targetId)).limit(1);
    if (!item) {
      throw new NotFoundError('Reported item not found');
    }
  } else {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!user) {
      throw new NotFoundError('Reported user not found');
    }
  }
}

export async function createReport(reporterId: string, input: CreateReportBody): Promise<ReportRow> {
  await assertTargetExists(input.targetType, input.targetId);

  const [existingOpen] = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, reporterId),
        eq(reports.targetType, input.targetType),
        eq(reports.targetId, input.targetId),
        eq(reports.status, 'OPEN'),
      ),
    )
    .limit(1);
  if (existingOpen) {
    throw new ConflictError('You already have an open report against this target');
  }

  try {
    const [created] = await db
      .insert(reports)
      .values({
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        note: input.note ?? null,
      })
      .returning();
    return created;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('You already have an open report against this target');
    }
    throw err;
  }
}

export async function getReports(
  filters: ReportsQuery,
): Promise<{ reports: ReportRow[]; pagination: ReportsPagination }> {
  const whereClause = eq(reports.status, filters.status);
  const offset = (filters.page - 1) * filters.limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(reports)
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(filters.limit)
      .offset(offset),
    db.select({ value: count() }).from(reports).where(whereClause),
  ]);

  const totalItems = Number(totalResult[0]?.value ?? 0);

  return {
    reports: rows,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / filters.limit),
    },
  };
}

async function getOpenReportOrThrow(reportId: string, requiredTargetType?: ReportTargetType): Promise<ReportRow> {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) {
    throw new NotFoundError('Report not found');
  }
  if (requiredTargetType && report.targetType !== requiredTargetType) {
    throw new ConflictError(`This report does not target a${requiredTargetType === 'ITEM' ? 'n' : ''} ${requiredTargetType.toLowerCase()}`);
  }
  if (report.status !== 'OPEN') {
    throw new ConflictError(`Cannot act on a report that is already ${report.status}`);
  }
  return report;
}

export async function reviewReport(reportId: string): Promise<ReportRow> {
  const report = await getOpenReportOrThrow(reportId);

  const [updated] = await db.update(reports).set({ status: 'REVIEWED' }).where(eq(reports.id, report.id)).returning();
  return updated;
}

export async function removeReportedItem(reportId: string): Promise<ReportRow> {
  const report = await getOpenReportOrThrow(reportId, 'ITEM');

  return db.transaction(async (tx) => {
    await itemsService.adminRemoveItem(tx, report.targetId);

    const [updatedReport] = await tx
      .update(reports)
      .set({ status: 'REVIEWED' })
      .where(eq(reports.id, report.id))
      .returning();
    return updatedReport;
  });
}

export async function suspendReportedUser(reportId: string): Promise<ReportRow> {
  const report = await getOpenReportOrThrow(reportId, 'USER');

  return db.transaction(async (tx) => {
    await usersService.suspendUser(report.targetId, report.reason, tx);

    const [updatedReport] = await tx
      .update(reports)
      .set({ status: 'REVIEWED' })
      .where(eq(reports.id, report.id))
      .returning();
    return updatedReport;
  });
}
