import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountAPI } from '../api/account.api.js';
import { HttpClient } from '../api/http-client.js';
import { AlxConfig } from '../config.js';

vi.mock('../api/http-client.js', () => {
  const MockHttpClient = vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  }));
  return { HttpClient: MockHttpClient, HttpClientError: class extends Error {} };
});

describe('AccountAPI', () => {
  let api: AccountAPI;
  let http: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    AlxConfig.setup({ accountManagerApi: 'http://accounts.test' });
    api = new AccountAPI('http://accounts.test');
    http = (api as unknown as { http: typeof http }).http;
  });

  describe('list()', () => {
    it('calls GET /accounts with pagination params', async () => {
      await api.list({ page: 1, limit: 20 });
      expect(http.get).toHaveBeenCalledWith('/accounts', { page: 1, limit: 20 });
    });

    it('calls GET /accounts without params', async () => {
      await api.list();
      expect(http.get).toHaveBeenCalledWith('/accounts', undefined);
    });
  });

  describe('getById()', () => {
    it('calls GET /accounts/:id', async () => {
      await api.getById('abc');
      expect(http.get).toHaveBeenCalledWith('/accounts/abc');
    });
  });

  describe('create()', () => {
    it('calls POST /accounts with body', async () => {
      const data = { email: 'test@test.com', provider: 'gmail' };
      await api.create(data);
      expect(http.post).toHaveBeenCalledWith('/accounts', data);
    });
  });

  describe('update()', () => {
    it('calls PUT /accounts/:id with body', async () => {
      const data = { email: 'updated@test.com' };
      await api.update('abc', data);
      expect(http.put).toHaveBeenCalledWith('/accounts/abc', data);
    });
  });

  describe('remove()', () => {
    it('calls DELETE /accounts/:id', async () => {
      await api.remove('abc');
      expect(http.delete).toHaveBeenCalledWith('/accounts/abc');
    });
  });

  describe('testConnection()', () => {
    it('calls POST /accounts/:id/test', async () => {
      await api.testConnection('abc');
      expect(http.post).toHaveBeenCalledWith('/accounts/abc/test');
    });
  });

  describe('getHealth()', () => {
    it('calls GET /accounts/:id/health', async () => {
      await api.getHealth('abc');
      expect(http.get).toHaveBeenCalledWith('/accounts/abc/health');
    });
  });

  describe('getAllHealth()', () => {
    it('calls GET /accounts/health', async () => {
      await api.getAllHealth();
      expect(http.get).toHaveBeenCalledWith('/accounts/health');
    });
  });

  describe('getCapacity()', () => {
    it('calls GET /accounts/capacity', async () => {
      await api.getCapacity();
      expect(http.get).toHaveBeenCalledWith('/accounts/capacity');
    });
  });

  describe('getSettings()', () => {
    it('calls GET /settings', async () => {
      await api.getSettings();
      expect(http.get).toHaveBeenCalledWith('/settings');
    });
  });

  describe('updateSettings()', () => {
    it('calls PATCH /settings with data', async () => {
      const data = { maxRetries: 5 };
      await api.updateSettings(data);
      expect(http.patch).toHaveBeenCalledWith('/settings', data);
    });
  });

  describe('listIdentifiers()', () => {
    it('calls GET /identifiers with params', async () => {
      await api.listIdentifiers({ page: 2, limit: 10 });
      expect(http.get).toHaveBeenCalledWith('/identifiers', { page: 2, limit: 10 });
    });
  });

  describe('listDrafts()', () => {
    it('calls GET /drafts', async () => {
      await api.listDrafts();
      expect(http.get).toHaveBeenCalledWith('/drafts', undefined);
    });
  });

  describe('approveDraft()', () => {
    it('calls POST /drafts/:id/approve', async () => {
      await api.approveDraft('draft1');
      expect(http.post).toHaveBeenCalledWith('/drafts/draft1/approve');
    });
  });

  describe('bulkApprove()', () => {
    it('calls POST /drafts/bulk-approve with ids', async () => {
      await api.bulkApprove(['d1', 'd2']);
      expect(http.post).toHaveBeenCalledWith('/drafts/bulk-approve', { ids: ['d1', 'd2'] });
    });
  });
});
