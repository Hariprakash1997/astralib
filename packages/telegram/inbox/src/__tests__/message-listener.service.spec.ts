import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageListenerService } from '../services/message-listener.service';
import type { TelegramMessageModel } from '../schemas/telegram-message.schema';
import type { TelegramConversationSessionModel } from '../schemas/telegram-conversation-session.schema';
import type { TelegramInboxConfig } from '../types/config.types';

vi.mock('telegram/events', () => ({
  NewMessage: vi.fn().mockImplementation((opts) => ({ _opts: opts })),
  NewMessageEvent: vi.fn(),
}));

vi.mock('telegram', () => ({
  Api: {
    Message: vi.fn(),
  },
}));

function createMockAccountManager() {
  return {
    getClient: vi.fn(),
    getConnectedAccounts: vi.fn().mockReturnValue([]),
  };
}

function createMockMessageModel() {
  return {
    create: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null),
  } as unknown as TelegramMessageModel;
}

function createMockSessionModel() {
  return {
    findOneAndUpdate: vi.fn().mockResolvedValue(null),
  } as unknown as TelegramConversationSessionModel;
}

function createMockConfig(overrides?: Partial<TelegramInboxConfig>): TelegramInboxConfig {
  return {
    accountManager: createMockAccountManager() as any,
    db: { connection: {} as any },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

function createMockGateway() {
  return {
    emitNewMessage: vi.fn(),
  };
}

describe('MessageListenerService', () => {
  let service: MessageListenerService;
  let accountManager: ReturnType<typeof createMockAccountManager>;
  let TelegramMessage: ReturnType<typeof createMockMessageModel>;
  let TelegramConversationSession: ReturnType<typeof createMockSessionModel>;
  let config: TelegramInboxConfig;
  let gateway: ReturnType<typeof createMockGateway>;

  beforeEach(() => {
    accountManager = createMockAccountManager();
    TelegramMessage = createMockMessageModel();
    TelegramConversationSession = createMockSessionModel();
    config = createMockConfig({ accountManager: accountManager as any });
    gateway = createMockGateway();
    service = new MessageListenerService(
      accountManager as any,
      TelegramMessage as any,
      TelegramConversationSession as any,
      config,
      gateway as any,
    );
  });

  describe('attach()', () => {
    it('should attach a listener to a connected client', async () => {
      const mockClient = {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      const result = await service.attach('acc-1');

      expect(result).toBe(true);
      expect(mockClient.addEventHandler).toHaveBeenCalledTimes(1);
      expect(service.isAttached('acc-1')).toBe(true);
    });

    it('should return true and warn if already attached', async () => {
      const mockClient = {
        addEventHandler: vi.fn(),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');
      const result = await service.attach('acc-1');

      expect(result).toBe(true);
      expect(config.logger!.warn).toHaveBeenCalledWith('Listener already attached', { accountId: 'acc-1' });
      // addEventHandler should only be called once (first attach)
      expect(mockClient.addEventHandler).toHaveBeenCalledTimes(1);
    });

    it('should return false when no connected client', async () => {
      accountManager.getClient.mockReturnValue(null);

      const result = await service.attach('acc-1');

      expect(result).toBe(false);
      expect(config.logger!.warn).toHaveBeenCalledWith('No connected client for account', { accountId: 'acc-1' });
      expect(service.isAttached('acc-1')).toBe(false);
    });
  });

  describe('detach()', () => {
    it('should detach listener and remove event handler', async () => {
      const mockClient = {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');
      await service.detach('acc-1');

      expect(mockClient.removeEventHandler).toHaveBeenCalledTimes(1);
      expect(service.isAttached('acc-1')).toBe(false);
    });

    it('should no-op if no listener exists for accountId', async () => {
      await service.detach('acc-nonexistent');

      // Should not throw or log anything
      expect(service.isAttached('acc-nonexistent')).toBe(false);
    });

    it('should handle error during removeEventHandler gracefully', async () => {
      const mockClient = {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn().mockImplementation(() => {
          throw new Error('remove failed');
        }),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');
      await service.detach('acc-1');

      expect(config.logger!.error).toHaveBeenCalledWith('Error removing event handler', expect.objectContaining({
        accountId: 'acc-1',
        error: 'remove failed',
      }));
      // Listener should still be cleaned up from internal map
      expect(service.isAttached('acc-1')).toBe(false);
    });

    it('should handle detach when client is no longer available', async () => {
      const mockClient = {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      };
      accountManager.getClient
        .mockReturnValueOnce(mockClient)  // for attach
        .mockReturnValueOnce(null);        // for detach

      await service.attach('acc-1');
      await service.detach('acc-1');

      // removeEventHandler should not be called since client is null
      expect(mockClient.removeEventHandler).not.toHaveBeenCalled();
      expect(service.isAttached('acc-1')).toBe(false);
    });
  });

  describe('attachAll()', () => {
    it('should attach listeners for all connected accounts', async () => {
      const mockClient = {
        addEventHandler: vi.fn(),
      };
      accountManager.getConnectedAccounts.mockReturnValue([
        { accountId: 'acc-1' },
        { accountId: 'acc-2' },
      ]);
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attachAll();

      expect(service.isAttached('acc-1')).toBe(true);
      expect(service.isAttached('acc-2')).toBe(true);
      expect(config.logger!.info).toHaveBeenCalledWith('All listeners attached', { count: 2 });
    });
  });

  describe('detachAll()', () => {
    it('should detach all attached listeners', async () => {
      const mockClient = {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');
      await service.attach('acc-2');
      await service.detachAll();

      expect(service.isAttached('acc-1')).toBe(false);
      expect(service.isAttached('acc-2')).toBe(false);
      expect(config.logger!.info).toHaveBeenCalledWith('All listeners detached', { count: 2 });
    });
  });

  describe('isAttached()', () => {
    it('should return false for unknown accountId', () => {
      expect(service.isAttached('unknown')).toBe(false);
    });

    it('should return true for attached accountId', async () => {
      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      expect(service.isAttached('acc-1')).toBe(true);
    });
  });

  describe('getAttachedAccounts()', () => {
    it('should return empty array when no listeners', () => {
      expect(service.getAttachedAccounts()).toEqual([]);
    });

    it('should return array of attached account IDs', async () => {
      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');
      await service.attach('acc-2');

      const accounts = service.getAttachedAccounts();
      expect(accounts).toContain('acc-1');
      expect(accounts).toContain('acc-2');
      expect(accounts).toHaveLength(2);
    });
  });

  describe('handleNewMessage (via event handler)', () => {
    it('should save inbound private message to DB', async () => {
      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      // Extract the handler that was registered
      const handler = mockClient.addEventHandler.mock.calls[0][0];

      const savedDoc = { _id: 'id-1', createdAt: new Date() };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(savedDoc);

      const event = {
        message: {
          id: 123,
          message: 'Hello from user',
          out: false,
          media: null,
        },
        isPrivate: true,
        getChat: vi.fn().mockResolvedValue({ id: BigInt(456), bot: false }),
      };

      await handler(event);

      expect(TelegramMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '456',
          messageId: '123',
          direction: 'inbound',
          senderType: 'user',
          content: 'Hello from user',
          contentType: 'text',
        }),
      );
    });

    it('should skip non-private messages', async () => {
      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      const handler = mockClient.addEventHandler.mock.calls[0][0];

      const event = {
        message: { id: 123, message: 'group msg', out: false, media: null },
        isPrivate: false,
        getChat: vi.fn(),
      };

      await handler(event);

      expect(TelegramMessage.create).not.toHaveBeenCalled();
      expect(event.getChat).not.toHaveBeenCalled();
    });

    it('should skip bot messages', async () => {
      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      const handler = mockClient.addEventHandler.mock.calls[0][0];

      const event = {
        message: { id: 123, message: 'bot msg', out: false, media: null },
        isPrivate: true,
        getChat: vi.fn().mockResolvedValue({ id: BigInt(789), bot: true }),
      };

      await handler(event);

      expect(TelegramMessage.create).not.toHaveBeenCalled();
    });

    it('should deduplicate by messageId', async () => {
      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      const handler = mockClient.addEventHandler.mock.calls[0][0];

      // findOne returns existing message (dedup)
      (TelegramMessage.findOne as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'existing' });

      const event = {
        message: { id: 123, message: 'dup msg', out: false, media: null },
        isPrivate: true,
        getChat: vi.fn().mockResolvedValue({ id: BigInt(456), bot: false }),
      };

      await handler(event);

      expect(TelegramMessage.create).not.toHaveBeenCalled();
    });

    it('should fire onNewMessage hook safely', async () => {
      const onNewMessage = vi.fn();
      config = createMockConfig({
        accountManager: accountManager as any,
        hooks: { onNewMessage },
      });
      service = new MessageListenerService(
        accountManager as any,
        TelegramMessage as any,
        TelegramConversationSession as any,
        config,
        gateway as any,
      );

      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      const handler = mockClient.addEventHandler.mock.calls[0][0];
      const savedDoc = { _id: 'id-1', createdAt: new Date() };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(savedDoc);

      const event = {
        message: { id: 200, message: 'test', out: false, media: null },
        isPrivate: true,
        getChat: vi.fn().mockResolvedValue({ id: BigInt(456), bot: false }),
      };

      await handler(event);

      expect(onNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '456',
          messageId: '200',
          direction: 'inbound',
        }),
      );
    });

    it('should not crash when onNewMessage hook throws', async () => {
      const onNewMessage = vi.fn().mockImplementation(() => {
        throw new Error('hook error');
      });
      config = createMockConfig({
        accountManager: accountManager as any,
        hooks: { onNewMessage },
      });
      service = new MessageListenerService(
        accountManager as any,
        TelegramMessage as any,
        TelegramConversationSession as any,
        config,
        gateway as any,
      );

      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      const handler = mockClient.addEventHandler.mock.calls[0][0];
      const savedDoc = { _id: 'id-1', createdAt: new Date() };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(savedDoc);

      const event = {
        message: { id: 300, message: 'test', out: false, media: null },
        isPrivate: true,
        getChat: vi.fn().mockResolvedValue({ id: BigInt(456), bot: false }),
      };

      // Should not throw
      await expect(handler(event)).resolves.not.toThrow();
    });

    it('should emit message via gateway', async () => {
      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      const handler = mockClient.addEventHandler.mock.calls[0][0];
      const savedDoc = { _id: 'id-1', createdAt: new Date() };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(savedDoc);

      const event = {
        message: { id: 400, message: 'gateway test', out: false, media: null },
        isPrivate: true,
        getChat: vi.fn().mockResolvedValue({ id: BigInt(456), bot: false }),
      };

      await handler(event);

      expect(gateway.emitNewMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: '456',
          messageId: '400',
        }),
      );
    });

    it('should handle outbound messages correctly', async () => {
      const mockClient = { addEventHandler: vi.fn() };
      accountManager.getClient.mockReturnValue(mockClient);

      await service.attach('acc-1');

      const handler = mockClient.addEventHandler.mock.calls[0][0];
      const savedDoc = { _id: 'id-1', createdAt: new Date() };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(savedDoc);

      const event = {
        message: { id: 500, message: 'sent by us', out: true, media: null },
        isPrivate: true,
        getChat: vi.fn().mockResolvedValue({ id: BigInt(789), bot: false }),
      };

      await handler(event);

      expect(TelegramMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'outbound',
          senderType: 'account',
          senderId: 'acc-1',
        }),
      );
    });

    it('should call media uploadAdapter when media is present and adapter configured', async () => {
      const uploadAdapter = vi.fn().mockResolvedValue({ url: 'https://cdn/photo.jpg', mimeType: 'image/jpeg' });
      config = createMockConfig({
        accountManager: accountManager as any,
        media: { uploadAdapter },
      });

      const mockClient = {
        addEventHandler: vi.fn(),
        downloadMedia: vi.fn().mockResolvedValue(Buffer.from('image-data')),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      service = new MessageListenerService(
        accountManager as any,
        TelegramMessage as any,
        TelegramConversationSession as any,
        config,
        gateway as any,
      );

      await service.attach('acc-1');

      const handler = mockClient.addEventHandler.mock.calls[0][0];
      const savedDoc = { _id: 'id-1', createdAt: new Date() };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(savedDoc);

      const event = {
        message: {
          id: 600,
          message: 'photo',
          out: false,
          media: { className: 'MessageMediaPhoto' },
        },
        isPrivate: true,
        getChat: vi.fn().mockResolvedValue({ id: BigInt(456), bot: false }),
      };

      await handler(event);

      expect(mockClient.downloadMedia).toHaveBeenCalled();
      expect(uploadAdapter).toHaveBeenCalled();
      expect(TelegramMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaUrl: 'https://cdn/photo.jpg',
          mediaType: 'image/jpeg',
        }),
      );
    });
  });
});
