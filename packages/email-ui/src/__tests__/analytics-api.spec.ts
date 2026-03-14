import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsAPI } from '../api/analytics.api.js';
import { HttpClient } from '../api/http-client.js';
import { AlxConfig } from '../config.js';

vi.mock('../api/http-client.js', () => {
  const MockHttpClient = vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
  }));
  return { HttpClient: MockHttpClient, HttpClientError: class extends Error {} };
});

describe('AnalyticsAPI', () => {
  let api: AnalyticsAPI;
  let http: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    AlxConfig.setup({ analyticsApi: 'http://analytics.test' });
    api = new AnalyticsAPI('http://analytics.test');
    http = (api as unknown as { http: typeof http }).http;
  });

  describe('getOverview()', () => {
    it('calls GET /overview with params', async () => {
      await api.getOverview({ from: '2025-01-01', to: '2025-01-31' });
      expect(http.get).toHaveBeenCalledWith('/overview', { from: '2025-01-01', to: '2025-01-31' });
    });

    it('calls GET /overview without params', async () => {
      await api.getOverview();
      expect(http.get).toHaveBeenCalledWith('/overview', undefined);
    });
  });

  describe('getTimeline()', () => {
    it('calls GET /timeline with params', async () => {
      await api.getTimeline({ granularity: 'day' });
      expect(http.get).toHaveBeenCalledWith('/timeline', { granularity: 'day' });
    });
  });

  describe('getAccountStats()', () => {
    it('calls GET /accounts with params', async () => {
      await api.getAccountStats({ accountId: 'a1' });
      expect(http.get).toHaveBeenCalledWith('/accounts', { accountId: 'a1' });
    });
  });

  describe('getRuleStats()', () => {
    it('calls GET /rules with params', async () => {
      await api.getRuleStats({ ruleId: 'r1' });
      expect(http.get).toHaveBeenCalledWith('/rules', { ruleId: 'r1' });
    });
  });

  describe('getTemplateStats()', () => {
    it('calls GET /templates with params', async () => {
      await api.getTemplateStats({ templateId: 't1' });
      expect(http.get).toHaveBeenCalledWith('/templates', { templateId: 't1' });
    });
  });

  describe('triggerAggregation()', () => {
    it('calls POST /aggregate with data', async () => {
      const data = { from: '2025-01-01' };
      await api.triggerAggregation(data);
      expect(http.post).toHaveBeenCalledWith('/aggregate', data);
    });

    it('calls POST /aggregate without data', async () => {
      await api.triggerAggregation();
      expect(http.post).toHaveBeenCalledWith('/aggregate', undefined);
    });
  });
});
