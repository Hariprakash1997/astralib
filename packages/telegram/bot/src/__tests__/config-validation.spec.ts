import { describe, it, expect } from 'vitest';
import { validateConfig } from '../validation/config.schema';
import { ConfigValidationError } from '../errors';

function makeValidConfig(overrides: Record<string, unknown> = {}) {
  return {
    token: 'test-bot-token-123',
    mode: 'polling',
    db: {
      connection: {}, // Mock Mongoose connection
    },
    ...overrides,
  };
}

describe('validateConfig', () => {
  it('accepts a valid polling config', () => {
    expect(() => validateConfig(makeValidConfig())).not.toThrow();
  });

  it('accepts a valid webhook config', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          mode: 'webhook',
          webhook: {
            domain: 'https://example.com',
            path: '/webhook',
            port: 8443,
          },
        }),
      ),
    ).not.toThrow();
  });

  it('accepts config with commands', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          commands: [
            { command: 'start', description: 'Start the bot', handler: () => {} },
            { command: 'help', description: 'Show help', handler: () => {} },
          ],
        }),
      ),
    ).not.toThrow();
  });

  it('accepts config with callbacks', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          callbacks: [{ pattern: /btn_.*/, handler: () => {} }],
        }),
      ),
    ).not.toThrow();
  });

  it('accepts config with inlineQueries', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          inlineQueries: [{ pattern: /.*/, handler: () => {} }],
        }),
      ),
    ).not.toThrow();
  });

  it('accepts config with middleware', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          middleware: [async (_msg: unknown, next: () => Promise<void>) => next()],
        }),
      ),
    ).not.toThrow();
  });

  it('accepts config with hooks', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          hooks: {
            onUserStart: () => {},
            onUserBlocked: () => {},
            onCommand: () => {},
            onError: () => {},
          },
        }),
      ),
    ).not.toThrow();
  });

  it('throws ConfigValidationError when token is missing', () => {
    expect(() => validateConfig(makeValidConfig({ token: '' }))).toThrow(
      ConfigValidationError,
    );
  });

  it('throws ConfigValidationError when token is absent', () => {
    const config = makeValidConfig();
    delete (config as any).token;
    expect(() => validateConfig(config)).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when mode is missing', () => {
    const config = makeValidConfig();
    delete (config as any).mode;
    expect(() => validateConfig(config)).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when mode is invalid', () => {
    expect(() => validateConfig(makeValidConfig({ mode: 'invalid' }))).toThrow(
      ConfigValidationError,
    );
  });

  it('throws ConfigValidationError when mode is webhook but webhook config is missing', () => {
    expect(() => validateConfig(makeValidConfig({ mode: 'webhook' }))).toThrow(
      ConfigValidationError,
    );
  });

  it('throws ConfigValidationError when webhook domain is not a URL', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          mode: 'webhook',
          webhook: { domain: 'not-a-url' },
        }),
      ),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when db is missing', () => {
    const config = makeValidConfig();
    delete (config as any).db;
    expect(() => validateConfig(config)).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when commands have empty command name', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          commands: [{ command: '', description: 'desc', handler: () => {} }],
        }),
      ),
    ).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError when commands have empty description', () => {
    expect(() =>
      validateConfig(
        makeValidConfig({
          commands: [{ command: 'test', description: '', handler: () => {} }],
        }),
      ),
    ).toThrow(ConfigValidationError);
  });

  it('error includes field information', () => {
    try {
      validateConfig(makeValidConfig({ token: '' }));
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      expect((err as ConfigValidationError).field).toBeDefined();
    }
  });

  it('error message contains "Invalid TelegramBotConfig"', () => {
    try {
      validateConfig(makeValidConfig({ token: '' }));
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('Invalid TelegramBotConfig');
    }
  });
});
