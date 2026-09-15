export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  location: string;
  profileImageUrl: string | null;
  bio: string | null;
  averageRating: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  location: string;
  phoneNumber: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}
