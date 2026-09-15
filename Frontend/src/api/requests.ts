import { apiGet, apiPatch, apiPost } from './client';
import type { BorrowRequest, BorrowRequestStatus } from '../types/borrowRequest';

export interface CreateRequestPayload {
  itemId: string;
  pickupDate: string;
  returnDate: string;
  message?: string;
}

export function createRequest(payload: CreateRequestPayload): Promise<{ request: BorrowRequest }> {
  return apiPost<{ request: BorrowRequest }>('/api/requests', payload);
}

export function getMyRequests(): Promise<{ requests: BorrowRequest[] }> {
  return apiGet<{ requests: BorrowRequest[] }>('/api/requests/mine');
}

export interface IncomingParams {
  status?: BorrowRequestStatus;
  itemId?: string;
}

export function getIncomingRequests(params: IncomingParams = {}): Promise<{ requests: BorrowRequest[] }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.itemId) query.set('itemId', params.itemId);
  const qs = query.toString();
  return apiGet<{ requests: BorrowRequest[] }>(`/api/requests/incoming${qs ? `?${qs}` : ''}`);
}

export function getRequest(id: string): Promise<{ request: BorrowRequest }> {
  return apiGet<{ request: BorrowRequest }>(`/api/requests/${id}`);
}

export function cancelRequest(id: string): Promise<{ request: BorrowRequest }> {
  return apiPatch<{ request: BorrowRequest }>(`/api/requests/${id}/cancel`);
}

export function acceptRequest(id: string): Promise<{ request: BorrowRequest }> {
  return apiPatch<{ request: BorrowRequest }>(`/api/requests/${id}/accept`);
}

export function declineRequest(id: string, reason?: string): Promise<{ request: BorrowRequest }> {
  return apiPatch<{ request: BorrowRequest }>(`/api/requests/${id}/decline`, reason ? { reason } : undefined);
}

export function confirmPickup(id: string, pickupCode: string): Promise<{ request: BorrowRequest }> {
  return apiPatch<{ request: BorrowRequest }>(`/api/requests/${id}/confirm-pickup`, { pickupCode });
}

export function confirmReturn(id: string, returnCode: string): Promise<{ request: BorrowRequest }> {
  return apiPatch<{ request: BorrowRequest }>(`/api/requests/${id}/confirm-return`, { returnCode });
}
