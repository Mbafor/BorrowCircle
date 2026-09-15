import { apiGet, apiPatch, apiPost } from './client';
import type { PublicProfile } from '../types/user';
import type { PublicReview } from '../types/rating';
import type { PaginatedResponse } from '../types/pagination';

export function getPublicProfile(id: string): Promise<{ user: PublicProfile }> {
  return apiGet<{ user: PublicProfile }>(`/api/users/${id}`);
}

export function getMe(): Promise<{ user: PublicProfile }> {
  return apiGet<{ user: PublicProfile }>('/api/users/me');
}

export interface UpdateProfilePayload {
  fullName?: string;
  phoneNumber?: string;
  location?: string;
  bio?: string | null;
}

export function updateMe(payload: UpdateProfilePayload): Promise<{ user: PublicProfile }> {
  return apiPatch<{ user: PublicProfile }>('/api/users/me', payload);
}

export function uploadProfilePhoto(file: File): Promise<{ user: PublicProfile }> {
  const formData = new FormData();
  formData.append('photo', file);
  return apiPost<{ user: PublicProfile }>('/api/users/me/photo', formData);
}

export interface ReviewsParams {
  page?: number;
  limit?: number;
}

export function getReviews(userId: string, params: ReviewsParams = {}): Promise<PaginatedResponse<PublicReview, 'reviews'>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<PaginatedResponse<PublicReview, 'reviews'>>(`/api/users/${userId}/reviews${qs ? `?${qs}` : ''}`);
}
