import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '../services/message.service';
import type { TelegramMessageModel } from '../schemas/telegram-message.schema';
import type { TelegramConversationSessionModel } from '../schemas/telegram-conversation-session.schema';
import type { TelegramInboxConfig } from '../types/config.types';

function createMockAccountManager() {
  return {
    getClient: vi.fn(),
    getConnectedAccounts: vi.fn().mockReturnValue([]),
  };
}

function createMockMessageModel() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndDelete: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  } as unknown as TelegramMessageModel;
}

function createMockSessionModel() {
  return {
    findOneAndUpdate: vi.fn(),
  } as unknown as TelegramConversationSessionModel;
}

function createMockConfig(overrides?: Partial<TelegramInboxConfig>): TelegramInboxConfig {
  return {
    accountManager: createMockAccountManager() as any,
    db: { connection: {} as any },
    ...overrides,
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('MessageService', () => {
  let service: MessageService;
  let accountManager: ReturnType<typeof createMockAccountManager>;
  let TelegramMessage: ReturnType<typeof createMockMessageModel>;
  let TelegramConversationSession: ReturnType<typeof createMockSessionModel>;
  let config: TelegramInboxConfig;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    accountManager = createMockAccountManager();
    TelegramMessage = createMockMessageModel();
    TelegramConversationSession = createMockSessionModel();
    logger = createMockLogger();
    config = createMockConfig({ accountManager: accountManager as any });
    service = new MessageService(
      accountManager as any,
      TelegramMessage as any,
      TelegramConversationSession as any,
      config,
      logger,
    );
  });

  describe('create()', () => {
    it('should create a new message document', async () => {
      const input = {
        conversationId: 'chat-1',
        messageId: 'msg-1',
        senderId: 'user-1',
        senderType: 'user' as const,
        direction: 'inbound' as const,
        contentType: 'text' as const,
        content: 'Hello world',
      };
      const createdDoc = { ...input, _id: 'id-1', createdAt: new Date() };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDoc);

      const result = await service.create(input);

      expect(TelegramMessage.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(createdDoc);
    });

    it('should log message creation with messageId and conversationId', async () => {
      const input = {
        conversationId: 'chat-1',
        messageId: 'msg-1',
        senderId: 'user-1',
        senderType: 'user' as const,
        direction: 'inbound' as const,
        contentType: 'text' as const,
        content: 'test',
      };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({ ...input });

      await service.create(input);

      expect(logger.info).toHaveBeenCalledWith('Message created', {
        messageId: 'msg-1',
        conversationId: 'chat-1',
      });
    });
  });

  describe('getById()', () => {
    it('should return document when found by ID', async () => {
      const doc = { _id: 'id-1', messageId: 'msg-1', content: 'hello' };
      (TelegramMessage.findById as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.getById('id-1');

      expect(TelegramMessage.findById).toHaveBeenCalledWith('id-1');
      expect(result).toEqual(doc);
    });

    it('should return null when not found', async () => {
      (TelegramMessage.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByMessageId()', () => {
    it('should return document when found by messageId', async () => {
      const doc = { _id: 'id-1', messageId: 'msg-123', content: 'hello' };
      (TelegramMessage.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.getByMessageId('msg-123');

      expect(TelegramMessage.findOne).toHaveBeenCalledWith({ messageId: 'msg-123' });
      expect(result).toEqual(doc);
    });

    it('should return null when not found', async () => {
      (TelegramMessage.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getByMessageId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('sendMessage()', () => {
    it('should send text message via TDLib client and save to DB', async () => {
      const mockClient = {
        sendMessage: vi.fn().mockResolvedValue({ id: 42 }),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      const savedDoc = {
        _id: 'id-1',
        conversationId: 'chat-1',
        messageId: '42',
        direction: 'outbound',
        content: 'Hello!',
      };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(savedDoc);

      const result = await service.sendMessage('acc-1', 'chat-1', 'Hello!');

      expect(mockClient.sendMessage).toHaveBeenCalledWith('chat-1', { message: 'Hello!' });
      expect(TelegramMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'chat-1',
          messageId: '42',
          senderId: 'acc-1',
          senderType: 'account',
          direction: 'outbound',
          contentType: 'text',
          content: 'Hello!',
        }),
      );
      expect(result).toEqual(savedDoc);
    });

    it('should send message with media attachment', async () => {
      const mockClient = {
        sendMessage: vi.fn().mockResolvedValue({ id: 43 }),
      };
      accountManager.getClient.mockReturnValue(mockClient);

      const savedDoc = { _id: 'id-1', messageId: '43', contentType: 'document' };
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue(savedDoc);

      const media = {
        buffer: Buffer.from('file content'),
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
      };

      await service.sendMessage('acc-1', 'chat-1', 'Here is a file', media);

      expect(mockClient.sendMessage).toHaveBeenCalledWith('chat-1', {
        message: 'Here is a file',
        file: media.buffer,
      });
      expect(TelegramMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'document',
        }),
      );
    });

    it('should throw when account is not connected', async () => {
      accountManager.getClient.mockReturnValue(null);

      await expect(service.sendMessage('acc-1', 'chat-1', 'hello'))
        .rejects.toThrow('Account acc-1 is not connected');
    });

    it('should update conversation session after sending', async () => {
      const mockClient = {
        sendMessage: vi.fn().mockResolvedValue({ id: 44 }),
      };
      accountManager.getClient.mockReturnValue(mockClient);
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'id-1' });

      await service.sendMessage('acc-1', 'chat-1', 'test');

      expect(TelegramConversationSession.findOneAndUpdate).toHaveBeenCalledWith(
        { conversationId: 'chat-1', accountId: 'acc-1', status: 'active' },
        {
          $inc: { messageCount: 1 },
          $set: { lastMessageAt: expect.any(Date) },
        },
      );
    });

    it('should log after sending message', async () => {
      const mockClient = {
        sendMessage: vi.fn().mockResolvedValue({ id: 45 }),
      };
      accountManager.getClient.mockReturnValue(mockClient);
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'id-1' });

      await service.sendMessage('acc-1', 'chat-1', 'test');

      expect(logger.info).toHaveBeenCalledWith('Message sent', {
        accountId: 'acc-1',
        chatId: 'chat-1',
        messageId: '45',
      });
    });

    it('should generate fallback messageId when sentMessage.id is missing', async () => {
      const mockClient = {
        sendMessage: vi.fn().mockResolvedValue({}),
      };
      accountManager.getClient.mockReturnValue(mockClient);
      (TelegramMessage.create as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'id-1' });

      await service.sendMessage('acc-1', 'chat-1', 'test');

      const createCall = (TelegramMessage.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.messageId).toMatch(/^out_\d+$/);
    });
  });

  describe('delete()', () => {
    it('should delete and return true when found', async () => {
      (TelegramMessage.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'id-1' });

      const result = await service.delete('id-1');

      expect(TelegramMessage.findByIdAndDelete).toHaveBeenCalledWith('id-1');
      expect(result).toBe(true);
    });

    it('should log on successful deletion', async () => {
      (TelegramMessage.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'id-1' });

      await service.delete('id-1');

      expect(logger.info).toHaveBeenCalledWith('Message deleted', { id: 'id-1' });
    });

    it('should return false when message not found', async () => {
      (TelegramMessage.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

});
