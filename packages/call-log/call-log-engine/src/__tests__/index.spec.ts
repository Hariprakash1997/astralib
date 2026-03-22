import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeConnection() {
  return {
    model: vi.fn().mockReturnValue({
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      updateMany: vi.fn(),
    }),
  };
}

function makeValidConfig(overrides: Record<string, unknown> = {}) {
  return {
    db: {
      connection: makeConnection(),
      collectionPrefix: 'test',
    },
    adapters: {
      lookupContact: vi.fn().mockResolvedValue(null),
      authenticateAgent: vi.fn().mockResolvedValue(null),
    },
    logger: mockLogger,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createCallLogEngine()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns all expected properties', async () => {
    const { createCallLogEngine } = await import('../index.js');
    const engine = createCallLogEngine(makeValidConfig());

    expect(engine).toHaveProperty('pipelines');
    expect(engine).toHaveProperty('callLogs');
    expect(engine).toHaveProperty('timeline');
    expect(engine).toHaveProperty('analytics');
    expect(engine).toHaveProperty('settings');
    expect(engine).toHaveProperty('export');
    expect(engine).toHaveProperty('routes');
    expect(engine).toHaveProperty('models');
    expect(engine).toHaveProperty('destroy');
    expect(engine.models).toHaveProperty('Pipeline');
    expect(engine.models).toHaveProperty('CallLog');
    expect(engine.models).toHaveProperty('CallLogSettings');

    await engine.destroy();
  });

  it('routes is an express Router', async () => {
    const { createCallLogEngine } = await import('../index.js');
    const engine = createCallLogEngine(makeValidConfig());

    // An Express Router has a 'handle' or 'stack' property
    expect(engine.routes).toBeTruthy();
    expect(typeof engine.routes).toBe('function');

    await engine.destroy();
  });

  describe('Zod validation', () => {
    it('throws when adapters.lookupContact is missing', async () => {
      const { createCallLogEngine } = await import('../index.js');
      const config = makeValidConfig();
      delete (config.adapters as Record<string, unknown>)['lookupContact'];

      expect(() => createCallLogEngine(config as Parameters<typeof createCallLogEngine>[0])).toThrow(
        /Invalid CallLogEngineConfig/,
      );
    });

    it('throws when adapters.authenticateAgent is missing', async () => {
      const { createCallLogEngine } = await import('../index.js');
      const config = makeValidConfig();
      delete (config.adapters as Record<string, unknown>)['authenticateAgent'];

      expect(() => createCallLogEngine(config as Parameters<typeof createCallLogEngine>[0])).toThrow(
        /Invalid CallLogEngineConfig/,
      );
    });

    it('throws when db is missing entirely', async () => {
      const { createCallLogEngine } = await import('../index.js');
      const config = makeValidConfig();
      delete (config as Record<string, unknown>)['db'];

      expect(() => createCallLogEngine(config as Parameters<typeof createCallLogEngine>[0])).toThrow();
    });

    it('accepts a valid config without optional fields', async () => {
      const { createCallLogEngine } = await import('../index.js');
      const config = {
        db: { connection: makeConnection() },
        adapters: {
          lookupContact: vi.fn(),
          authenticateAgent: vi.fn(),
        },
      };
      expect(() => createCallLogEngine(config)).not.toThrow();
      const engine = createCallLogEngine(config);
      await engine.destroy();
    });
  });

  describe('destroy()', () => {
    it('stops the follow-up worker (clearInterval called)', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const { createCallLogEngine } = await import('../index.js');
      const engine = createCallLogEngine(makeValidConfig());
      await engine.destroy();
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('logs destruction', async () => {
      const { createCallLogEngine } = await import('../index.js');
      const engine = createCallLogEngine(makeValidConfig());
      await engine.destroy();
      expect(mockLogger.info).toHaveBeenCalledWith('CallLogEngine destroyed');
    });
  });
});
