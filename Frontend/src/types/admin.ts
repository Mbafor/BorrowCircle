import type { UserRole, UserStatus } from './auth';

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  location: string;
  role: UserRole;
  status: UserStatus;
  averageRating: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalItemsByStatus: Record<string, number>;
  openReports: number;
  requestsCompletedLast30Days: number;
}
