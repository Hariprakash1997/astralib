import { describe, it, expect, vi } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function makeConnection() {
  return {
    model: vi.fn().mockReturnValue({
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      countDocuments: vi.fn().mockResolvedValue(0),
    }),
  };
}

function makeValidConfig(overrides: Record<string, unknown> = {}) {
  return {
    db: {
      connection: makeConnection(),
      collectionPrefix: 'test',
    },
    auth: {
      jwtSecret: 'supersecretkey',
    },
    adapters: {
      hashPassword: vi.fn().mockResolvedValue('hashed'),
      comparePassword: vi.fn().mockResolvedValue(true),
    },
    logger: mockLogger,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createStaffEngine()', () => {
  it('returns all expected properties for a valid config', async () => {
    const { createStaffEngine } = await import('../index.js');
    const engine = createStaffEngine(makeValidConfig() as Parameters<typeof createStaffEngine>[0]);

    expect(engine).toHaveProperty('routes');
    expect(engine).toHaveProperty('auth');
    expect(engine).toHaveProperty('staff');
    expect(engine).toHaveProperty('permissions');
    expect(engine).toHaveProperty('models');
    expect(engine).toHaveProperty('destroy');
    expect(engine.models).toHaveProperty('Staff');
    expect(engine.models).toHaveProperty('PermissionGroup');
  });

  it('routes is an express Router (function)', async () => {
    const { createStaffEngine } = await import('../index.js');
    const engine = createStaffEngine(makeValidConfig() as Parameters<typeof createStaffEngine>[0]);

    expect(engine.routes).toBeTruthy();
    expect(typeof engine.routes).toBe('function');
  });

  it('auth has expected middleware methods', async () => {
    const { createStaffEngine } = await import('../index.js');
    const engine = createStaffEngine(makeValidConfig() as Parameters<typeof createStaffEngine>[0]);

    expect(typeof engine.auth.verifyToken).toBe('function');
    expect(typeof engine.auth.requirePermission).toBe('function');
    expect(typeof engine.auth.ownerOnly).toBe('function');
    expect(typeof engine.auth.requireRole).toBe('function');
    expect(typeof engine.auth.resolveStaff).toBe('function');
  });

  describe('Zod validation', () => {
    it('throws when auth.jwtSecret is missing', async () => {
      const { createStaffEngine } = await import('../index.js');
      const config = makeValidConfig();
      (config as Record<string, unknown>)['auth'] = {};

      expect(() =>
        createStaffEngine(config as Parameters<typeof createStaffEngine>[0]),
      ).toThrow(/Invalid config for/i);
    });

    it('throws when adapters.hashPassword is missing', async () => {
      const { createStaffEngine } = await import('../index.js');
      const config = makeValidConfig();
      delete (config.adapters as Record<string, unknown>)['hashPassword'];

      expect(() =>
        createStaffEngine(config as Parameters<typeof createStaffEngine>[0]),
      ).toThrow(/Invalid config for/i);
    });

    it('throws when adapters.comparePassword is missing', async () => {
      const { createStaffEngine } = await import('../index.js');
      const config = makeValidConfig();
      delete (config.adapters as Record<string, unknown>)['comparePassword'];

      expect(() =>
        createStaffEngine(config as Parameters<typeof createStaffEngine>[0]),
      ).toThrow(/Invalid config for/i);
    });

    it('throws when db.connection is missing', async () => {
      const { createStaffEngine } = await import('../index.js');
      const config = makeValidConfig();
      delete (config.db as Record<string, unknown>)['connection'];

      expect(() =>
        createStaffEngine(config as Parameters<typeof createStaffEngine>[0]),
      ).toThrow(/Invalid config for/i);
    });

    it('accepts a valid config without optional fields', async () => {
      const { createStaffEngine } = await import('../index.js');
      const config = {
        db: { connection: makeConnection() },
        auth: { jwtSecret: 'secret123' },
        adapters: {
          hashPassword: vi.fn().mockResolvedValue('hashed'),
          comparePassword: vi.fn().mockResolvedValue(true),
        },
      };

      expect(() =>
        createStaffEngine(config as Parameters<typeof createStaffEngine>[0]),
      ).not.toThrow();
    });
  });

  describe('destroy()', () => {
    it('can be called without error', async () => {
      const { createStaffEngine } = await import('../index.js');
      const engine = createStaffEngine(makeValidConfig() as Parameters<typeof createStaffEngine>[0]);

      await expect(engine.destroy()).resolves.toBeUndefined();
    });

    it('logs destruction message', async () => {
      vi.clearAllMocks();
      const { createStaffEngine } = await import('../index.js');
      const engine = createStaffEngine(makeValidConfig() as Parameters<typeof createStaffEngine>[0]);
      await engine.destroy();

      expect(mockLogger.info).toHaveBeenCalledWith('StaffEngine destroyed');
    });
  });

  describe('default options', () => {
    it('applies DEFAULT_OPTIONS when options not provided', async () => {
      const { createStaffEngine, DEFAULT_OPTIONS } = await import('../index.js');
      const engine = createStaffEngine(makeValidConfig() as Parameters<typeof createStaffEngine>[0]);

      // Engine created successfully — default options were applied
      expect(engine).toHaveProperty('staff');
      expect(DEFAULT_OPTIONS.requireEmailUniqueness).toBe(true);
      expect(DEFAULT_OPTIONS.allowSelfPasswordChange).toBe(false);
    });
  });
});
