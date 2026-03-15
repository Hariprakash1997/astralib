import { AlxConfig } from '../config.js';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return '';
  const qs = new URLSearchParams();
  for (const [key, value] of entries) {
    qs.set(key, String(value));
  }
  return '?' + qs.toString();
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => null);
    }
    throw new HttpClientError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      body,
    );
  }
  if (response.status === 204) return undefined as T;
  const json = await response.json();
  if (json && typeof json === 'object' && 'success' in json) {
    if (json.success === false) {
      throw new HttpClientError(
        json.error ?? json.message ?? 'Request failed',
        response.status,
        json,
      );
    }
    return (json.data ?? json) as T;
  }
  return json as T;
}

export class HttpClient {
  constructor(private baseUrl: string) {}

  private url(path: string, params?: Record<string, unknown>): string {
    return this.baseUrl + path + buildQueryString(params);
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.url(path, params), {
      method: 'GET',
      headers: AlxConfig.getHeaders(),
    });
    return handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(this.url(path), {
      method: 'POST',
      headers: AlxConfig.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(this.url(path), {
      method: 'PUT',
      headers: AlxConfig.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(this.url(path), {
      method: 'PATCH',
      headers: AlxConfig.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(this.url(path), {
      method: 'DELETE',
      headers: AlxConfig.getHeaders(),
    });
    return handleResponse<T>(response);
  }
}
