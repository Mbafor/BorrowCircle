import { apiGet, apiPatch } from './client';
import type { Notification } from '../types/notification';
import type { PaginatedResponse } from '../types/pagination';

export interface NotificationsParams {
  read?: boolean;
  page?: number;
  limit?: number;
}

export function getNotifications(params: NotificationsParams = {}): Promise<PaginatedResponse<Notification, 'notifications'>> {
  const query = new URLSearchParams();
  if (params.read !== undefined) query.set('read', String(params.read));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedResponse<Notification, 'notifications'>>(`/api/notifications${qs ? `?${qs}` : ''}`);
}

export function getUnreadCount(): Promise<{ count: number }> {
  return apiGet<{ count: number }>('/api/notifications/unread-count');
}

export function markRead(id: string): Promise<{ notification: Notification }> {
  return apiPatch<{ notification: Notification }>(`/api/notifications/${id}/read`);
}

export function markAllRead(): Promise<{ markedCount: number }> {
  return apiPatch<{ markedCount: number }>('/api/notifications/read-all');
}
