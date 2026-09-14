import path from 'path';
import dotenv from 'dotenv';

const nodeEnv = process.env.NODE_ENV ?? 'development';

dotenv.config({
  path: path.resolve(process.cwd(), nodeEnv === 'test' ? '.env.test' : '.env'),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv,
  databaseUrl: requireEnv('DATABASE_URL'),
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
  allowedEmailDomains: requireEnv('ALLOWED_EMAIL_DOMAINS')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean),
  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
  jwtAccessExpiresIn: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  refreshTokenExpiresInDays: Number(optionalEnv('REFRESH_TOKEN_EXPIRES_IN_DAYS', '7')),
  passwordResetExpiresInMinutes: Number(optionalEnv('PASSWORD_RESET_EXPIRES_IN_MINUTES', '60')),
  bcryptSaltRounds: Number(optionalEnv('BCRYPT_SALT_ROUNDS', '12')),
};

export const isProduction = env.nodeEnv === 'production';
export const isTest = env.nodeEnv === 'test';
