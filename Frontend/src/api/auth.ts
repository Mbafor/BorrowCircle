import { apiGet, apiPost } from './client';
import type {
  ForgotPasswordPayload,
  LoginPayload,
  PublicUser,
  RegisterPayload,
  ResetPasswordPayload,
} from '../types/auth';

interface UserResponse {
  user: PublicUser;
}

interface MessageResponse {
  message: string;
}

export function register(payload: RegisterPayload): Promise<UserResponse> {
  return apiPost<UserResponse>('/api/auth/register', payload);
}

export function login(payload: LoginPayload): Promise<UserResponse> {
  return apiPost<UserResponse>('/api/auth/login', payload);
}

export function logout(): Promise<void> {
  return apiPost<void>('/api/auth/logout');
}

export function getMe(): Promise<UserResponse> {
  return apiGet<UserResponse>('/api/auth/me');
}

export function forgotPassword(payload: ForgotPasswordPayload): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/api/auth/forgot-password', payload);
}

export function resetPassword(payload: ResetPasswordPayload): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/api/auth/reset-password', payload);
}
