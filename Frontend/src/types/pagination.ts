export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

// The backend's list endpoints all share this { <key>: T[], pagination }
// envelope, but the key itself varies by resource (items, requests,
// notifications, reviews, reports, users) — K lets each resource's response
// type match that exactly instead of assuming a fixed key name.
export type PaginatedResponse<T, K extends string = 'items'> = {
  pagination: Pagination;
} & Record<K, T[]>;
