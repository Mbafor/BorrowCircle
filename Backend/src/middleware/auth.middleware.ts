import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/token';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

/**
 * Attaches req.userId when a valid access token is present, but never
 * rejects the request — used by endpoints that behave differently for an
 * owner vs. anyone else, but are still reachable anonymously (e.g. GET
 * /api/items/:id). A missing or invalid token is treated as anonymous.
 */
export function attachUserIfPresent(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.userId = payload.sub;
    } catch {
      // Invalid/expired token on an endpoint that supports anonymous access — ignore.
    }
  }

  next();
}
