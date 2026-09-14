import { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env';
import * as authService from '../services/auth.service';
import { UnauthorizedError } from '../utils/errors';
import { ForgotPasswordBody, LoginBody, RegisterBody, ResetPasswordBody } from '../validation/auth.validation';

const REFRESH_COOKIE_NAME = 'refreshToken';

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/api/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as RegisterBody;
    const user = await authService.registerUser(body);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as LoginBody;
    const { user, session } = await authService.loginUser(email, password);
    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    res.json({ user, accessToken: session.accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawRefreshToken) {
      await authService.logoutUser(rawRefreshToken);
    }
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Missing refresh token');
    }
    const session = await authService.refreshSession(rawRefreshToken);
    setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
    res.json({ accessToken: session.accessToken });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getUserProfile(req.userId as string);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as ForgotPasswordBody;
    await authService.requestPasswordReset(email);
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, newPassword } = req.body as ResetPasswordBody;
    await authService.resetPassword(token, newPassword);
    res.json({ message: 'Password reset successfully. Please log in again.' });
  } catch (err) {
    next(err);
  }
}
