import { NextFunction, Request, Response } from 'express';

const CSRF_HEADER = 'x-requested-with';
const CSRF_VALUE = 'BorrowCircle';
const PROTECTED_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * Lightweight CSRF mitigation appropriate for an MVP, made necessary by
 * moving auth tokens to cookies: a browser now attaches them automatically
 * to any request to this origin, including one forged by a cross-site form
 * or fetch. A cross-site request can't set a custom header (doing so would
 * require a CORS preflight this API doesn't allow for other origins), so
 * requiring one on every state-changing request blocks that forgery without
 * the complexity of a token-synchronization scheme. Applied globally, before
 * routing, so no endpoint can be added later without it.
 */
export function requireCsrfHeader(req: Request, res: Response, next: NextFunction): void {
  if (!PROTECTED_METHODS.has(req.method)) {
    next();
    return;
  }

  if (req.headers[CSRF_HEADER] !== CSRF_VALUE) {
    res.status(403).json({ error: 'Missing or invalid CSRF header' });
    return;
  }

  next();
}
