import { AlxTelegramConfig } from '../config.js';

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
    if (response.status === 401 || response.status === 403) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('alx-auth-error', {
          detail: { status: response.status, url: response.url },
        }));
      }
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
    const data = json.data ?? json;
    // Auto-unwrap single-item responses: { account: {...} } → {...}
    // But NOT arrays or multi-key objects: { accounts: [...], total: 5 } stays as-is
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const keys = Object.keys(data);
      if (keys.length === 1 && typeof data[keys[0]] === 'object' && !Array.isArray(data[keys[0]])) {
        return data[keys[0]] as T;
      }
    }
    return data as T;
  }
  return json as T;
}

export class HttpClient {
  constructor(private baseUrl: string) {}

  private url(path: string, params?: Record<string, unknown>): string {
    return this.baseUrl + path + buildQueryString(params);
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new HttpClientError('Request timed out', 0);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.fetchWithTimeout(this.url(path, params), {
      method: 'GET',
      headers: AlxTelegramConfig.getHeaders(),
    });
    return handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.fetchWithTimeout(this.url(path), {
      method: 'POST',
      headers: AlxTelegramConfig.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.fetchWithTimeout(this.url(path), {
      method: 'PUT',
      headers: AlxTelegramConfig.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.fetchWithTimeout(this.url(path), {
      method: 'PATCH',
      headers: AlxTelegramConfig.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await this.fetchWithTimeout(this.url(path), {
      method: 'DELETE',
      headers: AlxTelegramConfig.getHeaders(),
    });
    return handleResponse<T>(response);
  }
}
