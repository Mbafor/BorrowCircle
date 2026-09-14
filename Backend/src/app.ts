import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { isProduction } from './config/env';
import healthRoutes from './routes/healthRoutes';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  if (!isProduction) {
    app.use(morgan('dev'));
  }

  app.use(healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
