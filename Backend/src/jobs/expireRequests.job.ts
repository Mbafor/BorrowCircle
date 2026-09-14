import cron from 'node-cron';
import { expireStaleRequests } from '../services/requests.service';

/**
 * Runs the same expireStaleRequests() used lazily by the GET endpoints, so
 * pending requests still expire even if nobody happens to poll them.
 */
export function startExpireRequestsJob(): void {
  cron.schedule('*/15 * * * *', () => {
    expireStaleRequests().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to expire stale borrow requests:', err);
    });
  });
}
