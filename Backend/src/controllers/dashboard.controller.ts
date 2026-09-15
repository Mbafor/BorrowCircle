import { NextFunction, Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { BorrowingQuery, LendingQuery } from '../validation/dashboard.validation';

export async function getLending(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as LendingQuery;
    const result = await dashboardService.getLendingDashboard(req.userId as string, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getBorrowing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as BorrowingQuery;
    const result = await dashboardService.getBorrowingDashboard(req.userId as string, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await dashboardService.getDashboardSummary(req.userId as string);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}
