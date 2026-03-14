import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuleAPI } from '../api/rule.api.js';
import { HttpClient } from '../api/http-client.js';
import { AlxConfig } from '../config.js';

vi.mock('../api/http-client.js', () => {
  const MockHttpClient = vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  }));
  return { HttpClient: MockHttpClient, HttpClientError: class extends Error {} };
});

describe('RuleAPI', () => {
  let api: RuleAPI;
  let http: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    AlxConfig.setup({ ruleEngineApi: 'http://rules.test' });
    api = new RuleAPI('http://rules.test');
    http = (api as unknown as { http: typeof http }).http;
  });

  describe('listTemplates()', () => {
    it('calls GET /templates with params', async () => {
      await api.listTemplates({ page: 1, limit: 10 });
      expect(http.get).toHaveBeenCalledWith('/templates', { page: 1, limit: 10 });
    });
  });

  describe('createTemplate()', () => {
    it('calls POST /templates with body', async () => {
      const data = { name: 'Welcome', subject: 'Hello' };
      await api.createTemplate(data);
      expect(http.post).toHaveBeenCalledWith('/templates', data);
    });
  });

  describe('updateTemplate()', () => {
    it('calls PUT /templates/:id with body', async () => {
      const data = { name: 'Updated' };
      await api.updateTemplate('t1', data);
      expect(http.put).toHaveBeenCalledWith('/templates/t1', data);
    });
  });

  describe('deleteTemplate()', () => {
    it('calls DELETE /templates/:id', async () => {
      await api.deleteTemplate('t1');
      expect(http.delete).toHaveBeenCalledWith('/templates/t1');
    });
  });

  describe('listRules()', () => {
    it('calls GET /rules with params', async () => {
      await api.listRules({ page: 2, limit: 5 });
      expect(http.get).toHaveBeenCalledWith('/rules', { page: 2, limit: 5 });
    });
  });

  describe('createRule()', () => {
    it('calls POST /rules with body', async () => {
      const data = { name: 'Auto-reply', trigger: 'incoming' };
      await api.createRule(data);
      expect(http.post).toHaveBeenCalledWith('/rules', data);
    });
  });

  describe('toggleRule()', () => {
    it('calls POST /rules/:id/toggle', async () => {
      await api.toggleRule('r1');
      expect(http.post).toHaveBeenCalledWith('/rules/r1/toggle');
    });
  });

  describe('triggerRun()', () => {
    it('calls POST /runner', async () => {
      await api.triggerRun();
      expect(http.post).toHaveBeenCalledWith('/runner');
    });
  });

  describe('getRunHistory()', () => {
    it('calls GET /runner/logs with pagination', async () => {
      await api.getRunHistory({ page: 1, limit: 50 });
      expect(http.get).toHaveBeenCalledWith('/runner/logs', { page: 1, limit: 50 });
    });
  });

  describe('getThrottleSettings()', () => {
    it('calls GET /throttle', async () => {
      await api.getThrottleSettings();
      expect(http.get).toHaveBeenCalledWith('/throttle');
    });
  });

  describe('updateThrottleSettings()', () => {
    it('calls PUT /throttle with data', async () => {
      const data = { maxPerHour: 100 };
      await api.updateThrottleSettings(data);
      expect(http.put).toHaveBeenCalledWith('/throttle', data);
    });
  });
});
