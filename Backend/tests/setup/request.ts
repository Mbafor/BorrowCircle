import supertest from 'supertest';
import type { Application } from 'express';

const CSRF_HEADER = 'X-Requested-With';
const CSRF_VALUE = 'BorrowCircle';

/**
 * Thin wrapper around supertest that auto-attaches the CSRF header the
 * backend closeout pass now requires on every state-changing request (see
 * src/middleware/csrf.middleware.ts). Test files import this instead of
 * supertest directly so real CSRF protection stays exercised end-to-end
 * without every .post/.patch/.delete call site needing its own .set(...).
 * GET is untouched — CSRF only applies to state-changing methods. Tests
 * that specifically want to prove the CSRF check itself works (a request
 * with the header omitted should be rejected) import supertest directly.
 */
export default function request(app: Application) {
  const agent = supertest(app);
  return {
    get: (url: string) => agent.get(url),
    post: (url: string) => agent.post(url).set(CSRF_HEADER, CSRF_VALUE),
    patch: (url: string) => agent.patch(url).set(CSRF_HEADER, CSRF_VALUE),
    put: (url: string) => agent.put(url).set(CSRF_HEADER, CSRF_VALUE),
    delete: (url: string) => agent.delete(url).set(CSRF_HEADER, CSRF_VALUE),
  };
}
