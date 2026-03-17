import { describe, it, expect, beforeEach } from 'vitest';
import { AlxConfig } from '../config.js';

describe('AlxConfig', () => {
  beforeEach(() => {
    AlxConfig.setup({});
  });

  describe('setup()', () => {
    it('stores options', () => {
      AlxConfig.setup({
        accountManagerApi: 'http://localhost:3001',
        ruleEngineApi: 'http://localhost:3002',
        analyticsApi: 'http://localhost:3003',
        authToken: 'Bearer test-token',
        theme: 'dark',
        locale: 'en',
      });

      const config = AlxConfig.get();
      expect(config.accountManagerApi).toBe('http://localhost:3001');
      expect(config.ruleEngineApi).toBe('http://localhost:3002');
      expect(config.analyticsApi).toBe('http://localhost:3003');
      expect(config.authToken).toBe('Bearer test-token');
      expect(config.theme).toBe('dark');
      expect(config.locale).toBe('en');
    });
  });

  describe('get()', () => {
    it('returns current config', () => {
      AlxConfig.setup({ theme: 'light', locale: 'fr' });
      const config = AlxConfig.get();
      expect(config.theme).toBe('light');
      expect(config.locale).toBe('fr');
    });

    it('returns a copy so mutations do not affect internal state', () => {
      AlxConfig.setup({ theme: 'dark' });
      const config = AlxConfig.get();
      config.theme = 'light';
      expect(AlxConfig.get().theme).toBe('dark');
    });
  });

  describe('getApiUrl()', () => {
    beforeEach(() => {
      AlxConfig.setup({
        accountManagerApi: 'http://accounts.api',
        ruleEngineApi: 'http://rules.api',
        analyticsApi: 'http://analytics.api',
      });
    });

    it('returns correct URL for accountManager', () => {
      expect(AlxConfig.getApiUrl('accountManager')).toBe('http://accounts.api');
    });

    it('returns correct URL for ruleEngine', () => {
      expect(AlxConfig.getApiUrl('ruleEngine')).toBe('http://rules.api');
    });

    it('returns correct URL for analytics', () => {
      expect(AlxConfig.getApiUrl('analytics')).toBe('http://analytics.api');
    });

    it('returns empty string when URL is not configured', () => {
      AlxConfig.setup({});
      expect(AlxConfig.getApiUrl('accountManager')).toBe('');
    });
  });

  describe('getHeaders()', () => {
    it('returns auth headers when token is set', () => {
      AlxConfig.setup({ authToken: 'Bearer my-token' });
      const headers = AlxConfig.getHeaders();
      expect(headers['Authorization']).toBe('Bearer my-token');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('returns only Content-Type when no token is set', () => {
      AlxConfig.setup({});
      const headers = AlxConfig.getHeaders();
      expect(headers['Authorization']).toBeUndefined();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('setAuthToken()', () => {
    it('updates token', () => {
      AlxConfig.setup({});
      AlxConfig.setAuthToken('Bearer new-token');
      const headers = AlxConfig.getHeaders();
      expect(headers['Authorization']).toBe('Bearer new-token');
    });

    it('overwrites existing token', () => {
      AlxConfig.setup({ authToken: 'Bearer old' });
      AlxConfig.setAuthToken('Bearer new');
      expect(AlxConfig.get().authToken).toBe('Bearer new');
    });
  });
});
