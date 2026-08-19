const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api';

export interface ApiOk<T> {
  success: true;
  data: T;
}

export interface ApiErr {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (typeof window !== 'undefined') {
      const orgId = localStorage.getItem('airove_org_id');
      if (orgId) headers['X-Org-Id'] = orgId;
    }
    return headers;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.set(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    const json = (await res.json()) as ApiResult<T>;

    if (!json.success) {
      const err = json as ApiErr;
      throw new ApiError(err.error.code, err.error.message, res.status, err.error.details);
    }

    return (json as ApiOk<T>).data;
  }

  get<T>(path: string, params?: Record<string, string | number | undefined>) {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body);
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'ApiError';
  }
}

export const api = new ApiClient(API_BASE);

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
