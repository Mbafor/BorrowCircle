import cron from 'node-cron';
import { expireStaleRequests, flagOverdueRequests } from '../services/requests.service';

/**
 * Runs the same expireStaleRequests() and flagOverdueRequests() used lazily
 * by the GET endpoints, so pending/overdue requests still get flagged even
 * if nobody happens to poll them. One schedule, not two separate ones.
 */
export function startExpireRequestsJob(): void {
  cron.schedule('*/15 * * * *', () => {
    expireStaleRequests().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to expire stale borrow requests:', err);
    });
    flagOverdueRequests().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to flag overdue borrow requests:', err);
    });
  });
}
