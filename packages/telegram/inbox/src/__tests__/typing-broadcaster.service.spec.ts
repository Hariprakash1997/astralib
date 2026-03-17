import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TypingBroadcasterService } from '../services/typing-broadcaster.service';
import type { TelegramInboxConfig } from '../types/config.types';

vi.mock('telegram', () => ({
  Api: {
    messages: {
      SetTyping: vi.fn().mockImplementation((opts) => ({ _opts: opts })),
    },
    SendMessageTypingAction: vi.fn().mockImplementation(() => ({})),
  },
}));

function createMockAccountManager() {
  return {
    getClient: vi.fn(),
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockConfig(overrides?: Partial<TelegramInboxConfig>): TelegramInboxConfig {
  return {
    accountManager: createMockAccountManager() as any,
    db: { connection: {} as any },
    ...overrides,
  };
}

describe('TypingBroadcasterService', () => {
  let service: TypingBroadcasterService;
  let accountManager: ReturnType<typeof createMockAccountManager>;
  let logger: ReturnType<typeof createMockLogger>;
  let config: TelegramInboxConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    accountManager = createMockAccountManager();
    logger = createMockLogger();
    config = createMockConfig({ accountManager: accountManager as any });
    service = new TypingBroadcasterService(accountManager as any, config, logger);
  });

  afterEach(() => {
    service.stopAll();
    vi.useRealTimers();
  });

  describe('startTyping()', () => {
    it('should invoke SetTyping on the TDLib client', async () => {
      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');

      expect(mockClient.invoke).toHaveBeenCalledTimes(1);
    });

    it('should set typing state to true', async () => {
      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');

      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);
    });

    it('should warn when no client is connected', async () => {
      accountManager.getClient.mockReturnValue(null);

      await service.startTyping('chat-1', 'acc-1');

      expect(logger.warn).toHaveBeenCalledWith('No connected client for typing', {
        accountId: 'acc-1',
        chatId: 'chat-1',
      });
      expect(service.isTyping('chat-1', 'acc-1')).toBe(false);
    });

    it('should handle client.invoke errors gracefully', async () => {
      const mockClient = {
        invoke: vi.fn().mockRejectedValue(new Error('invoke failed')),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');

      expect(logger.error).toHaveBeenCalledWith('Failed to set typing action', expect.objectContaining({
        chatId: 'chat-1',
        accountId: 'acc-1',
        error: 'invoke failed',
      }));
      expect(service.isTyping('chat-1', 'acc-1')).toBe(false);
    });

    it('should fire onTyping hook', async () => {
      const onTyping = vi.fn();
      config = createMockConfig({
        accountManager: accountManager as any,
        hooks: { onTyping },
      });
      service = new TypingBroadcasterService(accountManager as any, config, logger);

      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');

      expect(onTyping).toHaveBeenCalledWith({
        chatId: 'chat-1',
        userId: 'chat-1',
        accountId: 'acc-1',
      });
    });

    it('should not crash when onTyping hook throws', async () => {
      const onTyping = vi.fn().mockImplementation(() => {
        throw new Error('hook error');
      });
      config = createMockConfig({
        accountManager: accountManager as any,
        hooks: { onTyping },
      });
      service = new TypingBroadcasterService(accountManager as any, config, logger);

      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await expect(service.startTyping('chat-1', 'acc-1')).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith('Hook onTyping error', expect.objectContaining({
        error: 'hook error',
      }));
    });

    it('should clear existing timeout when called again for same chat:account', async () => {
      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');
      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);

      // Call again
      await service.startTyping('chat-1', 'acc-1');
      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);

      // invoke should have been called twice
      expect(mockClient.invoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('stopTyping()', () => {
    it('should clear typing state', async () => {
      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');
      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);

      service.stopTyping('chat-1', 'acc-1');
      expect(service.isTyping('chat-1', 'acc-1')).toBe(false);
    });

    it('should no-op when not currently typing', () => {
      service.stopTyping('chat-1', 'acc-1');
      expect(service.isTyping('chat-1', 'acc-1')).toBe(false);
    });
  });

  describe('auto-timeout', () => {
    it('should auto-clear typing state after timeout', async () => {
      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');
      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);

      // Advance past default timeout (5000ms)
      vi.advanceTimersByTime(5001);

      expect(service.isTyping('chat-1', 'acc-1')).toBe(false);
    });

    it('should respect custom typingTimeoutMs', async () => {
      config = createMockConfig({
        accountManager: accountManager as any,
        options: { typingTimeoutMs: 2000 },
      });
      service = new TypingBroadcasterService(accountManager as any, config, logger);

      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');
      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);

      vi.advanceTimersByTime(1999);
      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);

      vi.advanceTimersByTime(2);
      expect(service.isTyping('chat-1', 'acc-1')).toBe(false);
    });
  });

  describe('isTyping()', () => {
    it('should return false for unknown chat:account pair', () => {
      expect(service.isTyping('unknown', 'unknown')).toBe(false);
    });

    it('should return true when actively typing', async () => {
      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');

      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);
    });

    it('should track independent chat:account pairs', async () => {
      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');
      await service.startTyping('chat-2', 'acc-1');

      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);
      expect(service.isTyping('chat-2', 'acc-1')).toBe(true);
      expect(service.isTyping('chat-1', 'acc-2')).toBe(false);
    });
  });

  describe('stopAll()', () => {
    it('should clear all active typing states', async () => {
      const mockClient = {
        invoke: vi.fn().mockResolvedValue(true),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.startTyping('chat-1', 'acc-1');
      await service.startTyping('chat-2', 'acc-2');

      expect(service.isTyping('chat-1', 'acc-1')).toBe(true);
      expect(service.isTyping('chat-2', 'acc-2')).toBe(true);

      service.stopAll();

      expect(service.isTyping('chat-1', 'acc-1')).toBe(false);
      expect(service.isTyping('chat-2', 'acc-2')).toBe(false);
    });

    it('should be safe to call when no typing is active', () => {
      expect(() => service.stopAll()).not.toThrow();
    });
  });
});
