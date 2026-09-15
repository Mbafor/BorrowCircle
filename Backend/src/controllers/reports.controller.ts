import { NextFunction, Request, Response } from 'express';
import * as reportsService from '../services/reports.service';
import { CreateReportBody, ReportsQuery } from '../validation/reports.validation';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as CreateReportBody;
    const report = await reportsService.createReport(req.userId as string, body);
    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
}

export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as ReportsQuery;
    const result = await reportsService.getReports(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function review(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await reportsService.reviewReport(req.params.id);
    res.json({ report });
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await reportsService.removeReportedItem(req.params.id);
    res.json({ report });
  } catch (err) {
    next(err);
  }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await reportsService.suspendReportedUser(req.params.id);
    res.json({ report });
  } catch (err) {
    next(err);
  }
}
