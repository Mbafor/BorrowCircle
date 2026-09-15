import { apiGet, apiPatch, apiPost } from './client';
import type { Report, ReportStatus, ReportTargetType } from '../types/report';
import type { PaginatedResponse } from '../types/pagination';

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  note?: string;
}

export function createReport(payload: CreateReportPayload): Promise<{ report: Report }> {
  return apiPost<{ report: Report }>('/api/reports', payload);
}

export interface AdminReportsParams {
  status?: ReportStatus;
  page?: number;
  limit?: number;
}

// Admin-only listing (GET /api/reports requires requireAdmin at the route).
export function getReports(params: AdminReportsParams = {}): Promise<PaginatedResponse<Report, 'reports'>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedResponse<Report, 'reports'>>(`/api/reports${qs ? `?${qs}` : ''}`);
}

export function reviewReport(id: string): Promise<{ report: Report }> {
  return apiPatch<{ report: Report }>(`/api/reports/${id}/review`);
}

export function removeReportedItem(id: string): Promise<{ report: Report }> {
  return apiPost<{ report: Report }>(`/api/reports/${id}/remove-item`);
}

export function suspendReportedUser(id: string): Promise<{ report: Report }> {
  return apiPost<{ report: Report }>(`/api/reports/${id}/suspend-user`);
}
