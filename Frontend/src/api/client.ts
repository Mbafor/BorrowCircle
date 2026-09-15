const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

const CSRF_HEADER = 'X-Requested-With';
const CSRF_VALUE = 'BorrowCircle';
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

// Auth endpoints are excluded from the 401-refresh-retry cycle below: retrying
// a failed login/register with the same body just reproduces the same error,
// and letting a failed /refresh call trigger another /refresh would recurse.
const NO_REFRESH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

interface ErrorBody {
  error?: string;
  fields?: Record<string, string>;
}

// Shared across concurrent requests so two 401s in flight at once trigger a
// single refresh call rather than a stampede of them.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER]: CSRF_VALUE },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  const isFormData = options.body instanceof FormData;

  // FormData bodies (file uploads) must NOT get an explicit Content-Type —
  // the browser sets one with the multipart boundary itself.
  if (options.body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (MUTATING_METHODS.has(method)) {
    headers[CSRF_HEADER] = CSRF_VALUE;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !isRetry && !NO_REFRESH_PATHS.has(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  if (!response.ok) {
    const data: ErrorBody | null = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error ?? `Request failed: ${response.status}`, data?.fields);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
