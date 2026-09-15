import { apiGet, apiPost } from './client';
import type { AdminStats, AdminUserSummary } from '../types/admin';
import type { UserStatus } from '../types/auth';
import type { Item, ItemStatus } from '../types/item';
import type { PaginatedResponse } from '../types/pagination';

export interface AdminUsersParams {
  status?: UserStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export function getAdminUsers(params: AdminUsersParams = {}): Promise<PaginatedResponse<AdminUserSummary, 'users'>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedResponse<AdminUserSummary, 'users'>>(`/api/admin/users${qs ? `?${qs}` : ''}`);
}

export function suspendUser(id: string, reason: string): Promise<{ user: AdminUserSummary }> {
  return apiPost<{ user: AdminUserSummary }>(`/api/admin/users/${id}/suspend`, { reason });
}

export function reactivateUser(id: string): Promise<{ user: AdminUserSummary }> {
  return apiPost<{ user: AdminUserSummary }>(`/api/admin/users/${id}/reactivate`);
}

export interface AdminItemsParams {
  status?: ItemStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export function getAdminItems(params: AdminItemsParams = {}): Promise<PaginatedResponse<Item, 'items'>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedResponse<Item, 'items'>>(`/api/admin/items${qs ? `?${qs}` : ''}`);
}

export function removeItem(id: string): Promise<{ item: Item }> {
  return apiPost<{ item: Item }>(`/api/admin/items/${id}/remove`);
}

export function getAdminStats(): Promise<AdminStats> {
  return apiGet<AdminStats>('/api/admin/stats');
}
