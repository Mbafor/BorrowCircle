import { createApp } from './app';
import { env } from './config/env';
import { startExpireRequestsJob } from './jobs/expireRequests.job';

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`BorrowCircle API listening on port ${env.port} (${env.nodeEnv})`);
});

startExpireRequestsJob();
