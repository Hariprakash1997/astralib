import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpClient, HttpClientError } from '../api/http-client.js';
import { AlxConfig } from '../config.js';

function mockFetchResponse(data: unknown, status = 200, statusText = 'OK') {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response);
}

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    AlxConfig.setup({ authToken: 'Bearer test-token' });
    client = new HttpClient('http://api.test');
    vi.restoreAllMocks();
  });

  describe('get()', () => {
    it('makes GET request with correct URL and headers', async () => {
      const fetchMock = mockFetchResponse({ items: [] });
      globalThis.fetch = fetchMock;

      await client.get('/items');

      expect(fetchMock).toHaveBeenCalledWith('http://api.test/items', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
    });

    it('appends query params correctly', async () => {
      const fetchMock = mockFetchResponse({ items: [] });
      globalThis.fetch = fetchMock;

      await client.get('/items', { page: 1, limit: 20 });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).toContain('limit=20');
    });

    it('skips undefined and null params', async () => {
      const fetchMock = mockFetchResponse({ items: [] });
      globalThis.fetch = fetchMock;

      await client.get('/items', { page: 1, filter: undefined, sort: null });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('page=1');
      expect(calledUrl).not.toContain('filter');
      expect(calledUrl).not.toContain('sort');
    });

    it('returns parsed JSON data', async () => {
      globalThis.fetch = mockFetchResponse({ id: '123', name: 'test' });
      const result = await client.get('/items/123');
      expect(result).toEqual({ id: '123', name: 'test' });
    });
  });

  describe('post()', () => {
    it('sends JSON body with Content-Type header', async () => {
      const fetchMock = mockFetchResponse({ id: '1' }, 201, 'Created');
      globalThis.fetch = fetchMock;

      const body = { name: 'new item', value: 42 };
      await client.post('/items', body);

      expect(fetchMock).toHaveBeenCalledWith('http://api.test/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(body),
      });
    });

    it('sends undefined body when no body provided', async () => {
      const fetchMock = mockFetchResponse({});
      globalThis.fetch = fetchMock;

      await client.post('/trigger');

      expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    });
  });

  describe('put()', () => {
    it('makes PUT request with body', async () => {
      const fetchMock = mockFetchResponse({ updated: true });
      globalThis.fetch = fetchMock;

      const body = { name: 'updated' };
      await client.put('/items/1', body);

      expect(fetchMock).toHaveBeenCalledWith('http://api.test/items/1', {
        method: 'PUT',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
    });
  });

  describe('patch()', () => {
    it('makes PATCH request with body', async () => {
      const fetchMock = mockFetchResponse({ patched: true });
      globalThis.fetch = fetchMock;

      const body = { status: 'active' };
      await client.patch('/items/1', body);

      expect(fetchMock).toHaveBeenCalledWith('http://api.test/items/1', {
        method: 'PATCH',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
    });
  });

  describe('delete()', () => {
    it('makes DELETE request', async () => {
      const fetchMock = mockFetchResponse(null, 204, 'No Content');
      globalThis.fetch = fetchMock;

      await client.delete('/items/1');

      expect(fetchMock).toHaveBeenCalledWith('http://api.test/items/1', {
        method: 'DELETE',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      });
    });
  });

  describe('error handling', () => {
    it('throws HttpClientError on non-ok response', async () => {
      globalThis.fetch = mockFetchResponse(
        { error: 'Not Found' },
        404,
        'Not Found',
      );

      await expect(client.get('/missing')).rejects.toThrow(HttpClientError);
    });

    it('includes status and body in HttpClientError', async () => {
      globalThis.fetch = mockFetchResponse(
        { message: 'Forbidden' },
        403,
        'Forbidden',
      );

      try {
        await client.get('/forbidden');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpClientError);
        const httpErr = err as HttpClientError;
        expect(httpErr.status).toBe(403);
        expect(httpErr.body).toEqual({ message: 'Forbidden' });
        expect(httpErr.message).toBe('HTTP 403: Forbidden');
      }
    });

    it('handles non-JSON error responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve('server error text'),
      } as unknown as Response);

      try {
        await client.get('/error');
        expect.fail('should have thrown');
      } catch (err) {
        const httpErr = err as HttpClientError;
        expect(httpErr.status).toBe(500);
        expect(httpErr.body).toBe('server error text');
      }
    });
  });

  describe('without auth token', () => {
    it('does not include Authorization header', async () => {
      AlxConfig.setup({});
      const fetchMock = mockFetchResponse({});
      globalThis.fetch = fetchMock;

      await client.get('/public');

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });
  });
});
