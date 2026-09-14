import { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env';
import { AppError, ValidationError } from '../utils/errors';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({ error: err.message, fields: err.fields });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';

  if (!isProduction) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(500).json({ error: isProduction ? 'Internal server error' : message });
}
