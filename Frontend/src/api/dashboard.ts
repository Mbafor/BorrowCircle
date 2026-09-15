import { apiGet } from './client';
import type { BorrowingRequestItem, DashboardSummary, LendingItem } from '../types/dashboard';
import type { PaginatedResponse } from '../types/pagination';
import type { ItemStatus } from '../types/item';
import type { BorrowRequestStatus } from '../types/borrowRequest';

export function getSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>('/api/dashboard/summary');
}

export interface LendingParams {
  status?: ItemStatus;
  page?: number;
  limit?: number;
}

export function getLending(params: LendingParams = {}): Promise<PaginatedResponse<LendingItem, 'items'>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedResponse<LendingItem, 'items'>>(`/api/dashboard/lending${qs ? `?${qs}` : ''}`);
}

export interface BorrowingParams {
  status?: BorrowRequestStatus;
  page?: number;
  limit?: number;
}

export function getBorrowing(params: BorrowingParams = {}): Promise<PaginatedResponse<BorrowingRequestItem, 'requests'>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedResponse<BorrowingRequestItem, 'requests'>>(`/api/dashboard/borrowing${qs ? `?${qs}` : ''}`);
}
