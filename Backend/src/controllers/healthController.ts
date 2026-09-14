import { Request, Response, NextFunction } from 'express';
import { checkDatabaseConnection } from '../config/db';

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dbHealthy = await checkDatabaseConnection();
    res.json({ status: 'ok', db: dbHealthy });
  } catch (err) {
    next(err);
  }
}
