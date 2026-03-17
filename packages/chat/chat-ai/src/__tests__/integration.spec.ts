import { describe, it, expect, vi } from 'vitest';
import { NoProviderConfiguredError, InvalidConfigError } from '../errors';
import { validateConfig } from '../validation';

// We cannot test the full createChatAI without a real mongoose connection,
// but we can test the validation and error paths.

describe('Integration', () => {
  describe('validateConfig', () => {
    it('should accept valid minimal config', () => {
      expect(() =>
        validateConfig({
          db: { connection: {} },
        }),
      ).not.toThrow();
    });

    it('should accept config with chat provider', () => {
      expect(() =>
        validateConfig({
          db: { connection: {} },
          chat: { generate: async () => ({ content: '' }) },
        }),
      ).not.toThrow();
    });

    it('should accept config with builtin memory backend', () => {
      expect(() =>
        validateConfig({
          db: { connection: {} },
          memoryBackend: { type: 'builtin' },
        }),
      ).not.toThrow();
    });

    it('should accept config with mem0 backend', () => {
      expect(() =>
        validateConfig({
          db: { connection: {} },
          memoryBackend: {
            type: 'mem0',
            client: { add: vi.fn(), getAll: vi.fn() },
          },
        }),
      ).not.toThrow();
    });

    it('should accept config with custom backend', () => {
      expect(() =>
        validateConfig({
          db: { connection: {} },
          memoryBackend: {
            type: 'custom',
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            list: vi.fn(),
            search: vi.fn(),
            getByVisitor: vi.fn(),
          },
        }),
      ).not.toThrow();
    });

    it('should accept config with embedding adapter', () => {
      expect(() =>
        validateConfig({
          db: { connection: {} },
          embedding: {
            generate: async () => [0.1],
            dimensions: 1536,
          },
        }),
      ).not.toThrow();
    });

    it('should accept config with search options', () => {
      expect(() =>
        validateConfig({
          db: { connection: {} },
          memorySearch: {
            strategy: 'text',
            maxMemories: 10,
            maxTokens: 2000,
          },
          knowledgeSearch: {
            strategy: 'priority',
            maxEntries: 5,
          },
        }),
      ).not.toThrow();
    });

    it('should reject config without db', () => {
      expect(() => validateConfig({})).toThrow(InvalidConfigError);
    });

    it('should reject config with null db.connection', () => {
      expect(() =>
        validateConfig({ db: { connection: null } }),
      ).toThrow(InvalidConfigError);
    });
  });

  describe('Error classes', () => {
    it('NoProviderConfiguredError should have correct code', () => {
      const err = new NoProviderConfiguredError();
      expect(err.code).toBe('NO_PROVIDER_CONFIGURED');
      expect(err.name).toBe('NoProviderConfiguredError');
    });

    it('InvalidConfigError should have field', () => {
      const err = new InvalidConfigError('bad config', 'db.connection');
      expect(err.field).toBe('db.connection');
      expect(err.code).toBe('INVALID_CONFIG');
    });
  });
});
