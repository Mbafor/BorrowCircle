import { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : 'Internal server error';

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(500).json({ error: isProduction ? 'Internal server error' : message });
}
