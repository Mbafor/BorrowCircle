import { apiGet, apiPost } from './client';
import type { PendingRating, Rating } from '../types/rating';

export function getMyPendingRatings(): Promise<{ pending: PendingRating[] }> {
  return apiGet<{ pending: PendingRating[] }>('/api/ratings/my-pending');
}

export interface CreateRatingPayload {
  borrowRequestId: string;
  score: number;
  comment?: string;
}

export function createRating(payload: CreateRatingPayload): Promise<{ rating: Rating }> {
  return apiPost<{ rating: Rating }>('/api/ratings', payload);
}
