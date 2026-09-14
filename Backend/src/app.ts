import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProduction, isTest } from './config/env';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/auth.routes';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  if (!isProduction && !isTest) {
    app.use(morgan('dev'));
  }

  app.use(healthRoutes);
  app.use(authRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
