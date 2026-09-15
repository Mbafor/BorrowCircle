import { NextFunction, Request, Response } from 'express';
import * as notificationsService from '../services/notifications.service';
import { NotificationsQuery } from '../validation/notifications.validation';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as NotificationsQuery;
    const result = await notificationsService.getNotifications(req.userId as string, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const unreadCountValue = await notificationsService.getUnreadCount(req.userId as string);
    res.json({ count: unreadCountValue });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notification = await notificationsService.markNotificationRead(req.params.id, req.userId as string);
    res.json({ notification });
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const markedCount = await notificationsService.markAllNotificationsRead(req.userId as string);
    res.json({ markedCount });
  } catch (err) {
    next(err);
  }
}
