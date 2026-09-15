import { NextFunction, Request, Response } from 'express';
import * as adminService from '../services/admin.service';
import { AdminItemsQuery, AdminUsersQuery, SuspendUserBody } from '../validation/admin.validation';

export async function listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as AdminUsersQuery;
    const result = await adminService.listUsers(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const detail = await adminService.getUserDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
}

export async function suspendUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as SuspendUserBody;
    const user = await adminService.suspendUserDirect(req.params.id, body.reason);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function reactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await adminService.reactivateUserDirect(req.params.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function listItems(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as AdminItemsQuery;
    const result = await adminService.listItems(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await adminService.removeItemDirect(req.params.id);
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await adminService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
