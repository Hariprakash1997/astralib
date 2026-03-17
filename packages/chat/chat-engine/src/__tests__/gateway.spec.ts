import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGateway, type GatewayDeps } from '../gateway';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';

// Mock socket.io to avoid real server creation
vi.mock('socket.io', () => {
  const mockNamespace = {
    on: vi.fn(),
    use: vi.fn(),
    emit: vi.fn(),
  };

  const MockServer = vi.fn().mockImplementation(() => ({
    of: vi.fn().mockReturnValue(mockNamespace),
    close: vi.fn((cb: () => void) => cb()),
  }));

  return { Server: MockServer };
});

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockService() {
  return new Proxy({}, {
    get: () => vi.fn().mockResolvedValue(undefined),
  });
}

function createMockDeps(): GatewayDeps {
  return {
    sessionService: createMockService() as any,
    messageService: createMockService() as any,
    agentService: createMockService() as any,
    settingsService: createMockService() as any,
    pendingMessageService: createMockService() as any,
    redisService: createMockService() as any,
    config: {
      db: { connection: {} as any },
      redis: { connection: {} as any },
      socket: {
        cors: { origin: '*' },
        namespaces: { visitor: '/chat', agent: '/agent' },
      },
      adapters: { assignAgent: vi.fn() },
    },
    options: DEFAULT_OPTIONS,
    logger: createMockLogger(),
  };
}

describe('Gateway', () => {
  let deps: GatewayDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  describe('createGateway()', () => {
    it('should return attach function and io getter', () => {
      const gateway = createGateway(deps);

      expect(gateway).toBeDefined();
      expect(typeof gateway.attach).toBe('function');
    });

    it('should create Socket.IO server when attached', () => {
      const gateway = createGateway(deps);

      const mockHttpServer = {} as any;
      gateway.attach(mockHttpServer);

      expect(gateway.io).toBeDefined();
      expect(deps.logger.info).toHaveBeenCalledWith('Chat gateway attached', {
        visitorPath: '/chat',
        agentPath: '/agent',
      });
    });

    it('should use default namespace paths when not configured', () => {
      deps.config.socket.namespaces = undefined;
      const gateway = createGateway(deps);

      const mockHttpServer = {} as any;
      gateway.attach(mockHttpServer);

      expect(deps.logger.info).toHaveBeenCalledWith('Chat gateway attached', {
        visitorPath: '/chat',
        agentPath: '/agent',
      });
    });
  });
});
