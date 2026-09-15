import { apiGet, apiPatch, apiPost } from './client';
import type { BorrowType, BrowseItem, Item, ItemStatus } from '../types/item';
import type { PaginatedResponse } from '../types/pagination';

export interface BrowseItemsParams {
  search?: string;
  category?: string;
  location?: string;
  borrowType?: BorrowType;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

export type BrowseItemsResponse = PaginatedResponse<BrowseItem, 'items'>;

export function browseItems(params: BrowseItemsParams = {}): Promise<BrowseItemsResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.location) query.set('location', params.location);
  if (params.borrowType) query.set('borrowType', params.borrowType);
  if (params.sort) query.set('sort', params.sort);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiGet<BrowseItemsResponse>(`/api/items${qs ? `?${qs}` : ''}`);
}

export function getItem(id: string): Promise<{ item: Item }> {
  return apiGet<{ item: Item }>(`/api/items/${id}`);
}

export interface CreateItemPayload {
  title: string;
  description: string;
  category: string;
  location: string;
  borrowType: BorrowType;
  pricePerDay?: number | null;
}

export function createItem(payload: CreateItemPayload): Promise<{ item: Item }> {
  return apiPost<{ item: Item }>('/api/items', payload);
}

export function uploadItemImages(itemId: string, files: File[]): Promise<{ item: Item }> {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  return apiPost<{ item: Item }>(`/api/items/${itemId}/images`, formData);
}

// Only 'AVAILABLE' | 'PAUSED' | 'CANCELLED' are valid targets here — 'REMOVED'
// is admin-only and the other statuses aren't reachable through this endpoint.
export function updateItemStatus(itemId: string, status: ItemStatus): Promise<{ item: Item }> {
  return apiPatch<{ item: Item }>(`/api/items/${itemId}/status`, { status });
}
