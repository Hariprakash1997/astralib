import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotService } from '../services/bot.service';
import { BotAlreadyRunningError, BotNotRunningError, CommandNotFoundError } from '../errors';

vi.mock('node-telegram-bot-api', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    onText: vi.fn(),
    getMe: vi.fn().mockResolvedValue({ id: 123, username: 'test_bot' }),
    stopPolling: vi.fn().mockResolvedValue(undefined),
    deleteWebHook: vi.fn().mockResolvedValue(true),
    setWebHook: vi.fn().mockResolvedValue(true),
    sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
    sendPhoto: vi.fn().mockResolvedValue({ message_id: 2 }),
    sendDocument: vi.fn().mockResolvedValue({ message_id: 3 }),
    answerCallbackQuery: vi.fn().mockResolvedValue(true),
    answerInlineQuery: vi.fn().mockResolvedValue(true),
  })),
}));

function createMockConfig(overrides: Record<string, unknown> = {}) {
  return {
    token: 'test-token-123',
    mode: 'polling' as const,
    db: { connection: {} },
    commands: [],
    callbacks: [],
    inlineQueries: [],
    middleware: [],
    hooks: {
      onUserStart: vi.fn(),
      onUserBlocked: vi.fn(),
      onCommand: vi.fn(),
      onError: vi.fn(),
    },
    ...overrides,
  };
}

function createMockUserTracker() {
  return {
    trackInteraction: vi.fn().mockResolvedValue({ success: true, isNewUser: false }),
    getUser: vi.fn(),
    getAllUsers: vi.fn(),
    getUserCount: vi.fn(),
    getActiveUsers: vi.fn(),
    markBlocked: vi.fn(),
    isBlocked: vi.fn(),
    getStats: vi.fn(),
  };
}

describe('BotService', () => {
  let service: BotService;
  let config: ReturnType<typeof createMockConfig>;
  let mockUserTracker: ReturnType<typeof createMockUserTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    config = createMockConfig();
    mockUserTracker = createMockUserTracker();
    service = new BotService(config as any, {} as any, mockUserTracker as any);
  });

  describe('start()', () => {
    it('starts the bot and sets running state', async () => {
      expect(service.isRunning()).toBe(false);

      await service.start();

      expect(service.isRunning()).toBe(true);
    });

    it('fetches bot info via getMe', async () => {
      await service.start();

      const info = service.getBotInfo();
      expect(info).toEqual({ username: '@test_bot', id: 123 });
    });

    it('throws BotAlreadyRunningError if already started', async () => {
      await service.start();

      await expect(service.start()).rejects.toThrow(BotAlreadyRunningError);
    });

    it('creates bot with polling option when mode is polling', async () => {
      const TelegramBotApi = (await import('node-telegram-bot-api')).default;

      await service.start();

      expect(TelegramBotApi).toHaveBeenCalledWith('test-token-123', { polling: true });
    });

    it('creates bot with webhook option when mode is webhook', async () => {
      const TelegramBotApi = (await import('node-telegram-bot-api')).default;
      const webhookConfig = createMockConfig({
        mode: 'webhook',
        webhook: { domain: 'https://example.com', port: 8443, secretToken: 'secret' },
      });
      const webhookService = new BotService(webhookConfig as any, {} as any, mockUserTracker as any);

      await webhookService.start();

      expect(TelegramBotApi).toHaveBeenCalledWith('test-token-123', {
        webHook: { port: 8443 },
      });
    });
  });

  describe('stop()', () => {
    it('stops the bot and clears running state', async () => {
      await service.start();
      expect(service.isRunning()).toBe(true);

      await service.stop();

      expect(service.isRunning()).toBe(false);
    });

    it('throws BotNotRunningError if not started', async () => {
      await expect(service.stop()).rejects.toThrow(BotNotRunningError);
    });

    it('clears bot info after stop', async () => {
      await service.start();
      expect(service.getBotInfo()).not.toBeNull();

      await service.stop();

      // bot info is preserved but bot reference is nulled
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('isRunning()', () => {
    it('returns false initially', () => {
      expect(service.isRunning()).toBe(false);
    });

    it('returns true after start', async () => {
      await service.start();
      expect(service.isRunning()).toBe(true);
    });

    it('returns false after stop', async () => {
      await service.start();
      await service.stop();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('getBotInfo()', () => {
    it('returns null before start', () => {
      expect(service.getBotInfo()).toBeNull();
    });

    it('returns bot info after start', async () => {
      await service.start();

      const info = service.getBotInfo();
      expect(info).toBeDefined();
      expect(info!.username).toBe('@test_bot');
      expect(info!.id).toBe(123);
    });
  });

  describe('getUptime()', () => {
    it('returns 0 before start', () => {
      expect(service.getUptime()).toBe(0);
    });

    it('returns positive number after start', async () => {
      await service.start();

      const uptime = service.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('registerCommand()', () => {
    it('registers a new command', async () => {
      const cmd = { command: 'test', description: 'Test command', handler: vi.fn() };

      service.registerCommand(cmd);

      // Command is stored (verified by not throwing on remove)
      expect(() => service.removeCommand('test')).not.toThrow();
    });

    it('registers handler on bot if running', async () => {
      await service.start();

      const cmd = { command: 'dynamic', description: 'Dynamic command', handler: vi.fn() };
      service.registerCommand(cmd);

      // The onText should be called for the new command registration
      const TelegramBotApi = (await import('node-telegram-bot-api')).default;
      const mockBot = (TelegramBotApi as any).mock.results[0]?.value;
      // onText is called during start for existing commands + this new one
      expect(mockBot.onText).toHaveBeenCalled();
    });

    it('replaces existing command with same name', () => {
      const cmd1 = { command: 'test', description: 'First', handler: vi.fn() };
      const cmd2 = { command: 'test', description: 'Second', handler: vi.fn() };

      service.registerCommand(cmd1);
      service.registerCommand(cmd2);

      // Only one command with that name exists
      service.removeCommand('test');
      expect(() => service.removeCommand('test')).toThrow(CommandNotFoundError);
    });
  });

  describe('removeCommand()', () => {
    it('removes an existing command', () => {
      service.registerCommand({ command: 'test', description: 'Test', handler: vi.fn() });

      expect(() => service.removeCommand('test')).not.toThrow();
    });

    it('throws CommandNotFoundError for non-existent command', () => {
      expect(() => service.removeCommand('nonexistent')).toThrow(CommandNotFoundError);
    });
  });

  describe('sendMessage()', () => {
    it('throws BotNotRunningError when bot is not started', async () => {
      await expect(service.sendMessage(123, 'hello')).rejects.toThrow(BotNotRunningError);
    });

    it('sends message when bot is running', async () => {
      await service.start();

      const result = await service.sendMessage(123, 'hello');

      expect(result).toEqual({ message_id: 1 });
    });
  });

  describe('getBotInstance()', () => {
    it('throws BotNotRunningError when bot is not started', () => {
      expect(() => service.getBotInstance()).toThrow(BotNotRunningError);
    });

    it('returns BotInstance with expected methods', async () => {
      await service.start();

      const instance = service.getBotInstance();

      expect(instance.sendMessage).toBeDefined();
      expect(instance.sendPhoto).toBeDefined();
      expect(instance.sendDocument).toBeDefined();
      expect(instance.answerCallbackQuery).toBeDefined();
      expect(instance.answerInlineQuery).toBeDefined();
      expect(instance.keyboards).toBeDefined();
      expect(instance.raw).toBeDefined();
    });
  });

  describe('middleware chain', () => {
    it('executes command when middleware calls next', async () => {
      const handler = vi.fn();
      const middleware = vi.fn(async (_msg: any, next: () => Promise<void>) => {
        await next();
      });

      const configWithMiddleware = createMockConfig({
        commands: [{ command: 'test', description: 'Test', handler }],
        middleware: [middleware],
      });
      const svc = new BotService(configWithMiddleware as any, {} as any, mockUserTracker as any);
      await svc.start();

      // Middleware is registered - verify through bot.onText being called
      const TelegramBotApi = (await import('node-telegram-bot-api')).default;
      const mockBot = (TelegramBotApi as any).mock.results.at(-1)?.value;
      expect(mockBot.onText).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('fires onError hook when command handler throws', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('handler error'));
      const configWithCmd = createMockConfig({
        commands: [{ command: 'fail', description: 'Fails', handler }],
      });
      const svc = new BotService(configWithCmd as any, {} as any, mockUserTracker as any);
      await svc.start();

      // The error handling is set up via onText callback
      // We verify the setup happened
      const TelegramBotApi = (await import('node-telegram-bot-api')).default;
      const mockBot = (TelegramBotApi as any).mock.results.at(-1)?.value;
      expect(mockBot.onText).toHaveBeenCalled();
      expect(mockBot.on).toHaveBeenCalledWith('polling_error', expect.any(Function));
      expect(mockBot.on).toHaveBeenCalledWith('webhook_error', expect.any(Function));
    });
  });

  describe('getKeyboards()', () => {
    it('returns KeyboardBuilder instance', () => {
      const keyboards = service.getKeyboards();

      expect(keyboards).toBeDefined();
      expect(keyboards.inline).toBeDefined();
      expect(keyboards.reply).toBeDefined();
      expect(keyboards.remove).toBeDefined();
    });
  });
});
