import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationService } from '../services/conversation.service';
import type { TelegramMessageModel } from '../schemas/telegram-message.schema';

function createMockMessageModel() {
  return {
    aggregate: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    findOne: vi.fn().mockResolvedValue(null),
    countDocuments: vi.fn().mockResolvedValue(0),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  } as unknown as TelegramMessageModel;
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('ConversationService', () => {
  let service: ConversationService;
  let TelegramMessage: ReturnType<typeof createMockMessageModel>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    TelegramMessage = createMockMessageModel();
    logger = createMockLogger();
    service = new ConversationService(TelegramMessage as any, logger);
  });

  describe('list()', () => {
    it('should return items and total from aggregation pipeline', async () => {
      const aggregateResults = [
        {
          _id: 'chat-1',
          lastMessage: { content: 'hello', contentType: 'text', direction: 'inbound', createdAt: new Date() },
          messageCount: 5,
          unreadCount: 2,
        },
      ];

      // First call is for count pipeline, second for items pipeline
      (TelegramMessage.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce(aggregateResults);

      const result = await service.list();

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].conversationId).toBe('chat-1');
      expect(result.items[0].messageCount).toBe(5);
      expect(result.items[0].unreadCount).toBe(2);
    });

    it('should return total 0 when count pipeline returns empty', async () => {
      (TelegramMessage.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.list();

      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should apply direction filter in match stage', async () => {
      (TelegramMessage.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.list({ direction: 'inbound' });

      const firstCallPipeline = (TelegramMessage.aggregate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const matchStage = firstCallPipeline.find((s: any) => s.$match);
      expect(matchStage.$match.direction).toBe('inbound');
    });

    it('should apply contentType filter', async () => {
      (TelegramMessage.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.list({ contentType: 'photo' });

      const firstCallPipeline = (TelegramMessage.aggregate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const matchStage = firstCallPipeline.find((s: any) => s.$match);
      expect(matchStage.$match.contentType).toBe('photo');
    });

    it('should apply date range filters', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      (TelegramMessage.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.list({ startDate, endDate });

      const firstCallPipeline = (TelegramMessage.aggregate as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const matchStage = firstCallPipeline.find((s: any) => s.$match);
      expect(matchStage.$match.createdAt.$gte).toBe(startDate);
      expect(matchStage.$match.createdAt.$lte).toBe(endDate);
    });

    it('should handle pagination with skip and limit', async () => {
      (TelegramMessage.aggregate as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([{ total: 100 }])
        .mockResolvedValueOnce([]);

      await service.list(undefined, 3, 20);

      const itemsPipeline = (TelegramMessage.aggregate as ReturnType<typeof vi.fn>).mock.calls[1][0];
      const skipStage = itemsPipeline.find((s: any) => s.$skip !== undefined);
      const limitStage = itemsPipeline.find((s: any) => s.$limit !== undefined);
      expect(skipStage.$skip).toBe(40); // (3-1) * 20
      expect(limitStage.$limit).toBe(20);
    });
  });

  describe('getMessages()', () => {
    it('should return paginated messages for a conversation', async () => {
      const messages = [
        { _id: 'id-1', conversationId: 'chat-1', content: 'hello' },
        { _id: 'id-2', conversationId: 'chat-1', content: 'world' },
      ];

      (TelegramMessage.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(messages),
          }),
        }),
      });
      (TelegramMessage.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const result = await service.getMessages('chat-1');

      expect(result.items).toEqual(messages);
      expect(result.total).toBe(10);
      expect(TelegramMessage.find).toHaveBeenCalledWith({ conversationId: 'chat-1' });
    });

    it('should apply page and limit for pagination', async () => {
      const sortMock = vi.fn();
      const skipMock = vi.fn();
      const limitMock = vi.fn().mockResolvedValue([]);

      skipMock.mockReturnValue({ limit: limitMock });
      sortMock.mockReturnValue({ skip: skipMock });
      (TelegramMessage.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: sortMock });
      (TelegramMessage.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.getMessages('chat-1', 2, 25);

      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
      expect(skipMock).toHaveBeenCalledWith(25); // (2-1) * 25
      expect(limitMock).toHaveBeenCalledWith(25);
    });

    it('should return empty items and zero total when no messages', async () => {
      const result = await service.getMessages('nonexistent');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('search()', () => {
    it('should search messages by content regex', async () => {
      const messages = [{ _id: 'id-1', content: 'hello world' }];

      (TelegramMessage.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(messages),
          }),
        }),
      });
      (TelegramMessage.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.search('hello');

      expect(result.items).toEqual(messages);
      expect(result.total).toBe(1);
      expect(TelegramMessage.find).toHaveBeenCalledWith({
        content: { $regex: 'hello', $options: 'i' },
      });
    });

    it('should apply pagination to search', async () => {
      const sortMock = vi.fn();
      const skipMock = vi.fn();
      const limitMock = vi.fn().mockResolvedValue([]);

      skipMock.mockReturnValue({ limit: limitMock });
      sortMock.mockReturnValue({ skip: skipMock });
      (TelegramMessage.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: sortMock });
      (TelegramMessage.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.search('test', 3, 10);

      expect(skipMock).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });

  describe('markAsRead()', () => {
    it('should mark all inbound unread messages in conversation as read', async () => {
      (TelegramMessage.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 5 });

      const result = await service.markAsRead('chat-1');

      expect(result).toBe(5);
      expect(TelegramMessage.updateMany).toHaveBeenCalledWith(
        { conversationId: 'chat-1', direction: 'inbound', readAt: null },
        { $set: { readAt: expect.any(Date) } },
      );
    });

    it('should limit marking to messages up to a specific messageId', async () => {
      const upToMessage = { createdAt: new Date('2025-06-01') };
      (TelegramMessage.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(upToMessage);
      (TelegramMessage.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 3 });

      const result = await service.markAsRead('chat-1', 'msg-100');

      expect(result).toBe(3);
      expect(TelegramMessage.findOne).toHaveBeenCalledWith({ messageId: 'msg-100' });
      expect(TelegramMessage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'chat-1',
          direction: 'inbound',
          readAt: null,
          createdAt: { $lte: upToMessage.createdAt },
        }),
        { $set: { readAt: expect.any(Date) } },
      );
    });

    it('should ignore upToMessageId if message not found', async () => {
      (TelegramMessage.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (TelegramMessage.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 2 });

      const result = await service.markAsRead('chat-1', 'nonexistent');

      expect(result).toBe(2);
      // Should not have createdAt constraint
      const updateCall = (TelegramMessage.updateMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateCall.createdAt).toBeUndefined();
    });

    it('should log after marking messages as read', async () => {
      (TelegramMessage.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 3 });

      await service.markAsRead('chat-1');

      expect(logger.info).toHaveBeenCalledWith('Messages marked as read', {
        conversationId: 'chat-1',
        count: 3,
      });
    });

    it('should fire onMessageRead hook after marking as read', async () => {
      const onMessageRead = vi.fn();
      const hooks = { onMessageRead };
      const serviceWithHooks = new ConversationService(TelegramMessage as any, logger, hooks);

      (TelegramMessage.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 2 });

      await serviceWithHooks.markAsRead('chat-1', 'msg-5');

      expect(onMessageRead).toHaveBeenCalledWith({
        messageId: 'msg-5',
        chatId: 'chat-1',
        readAt: expect.any(Date),
      });
    });

    it('should fire onMessageRead hook with "all" when no upToMessageId', async () => {
      const onMessageRead = vi.fn();
      const hooks = { onMessageRead };
      const serviceWithHooks = new ConversationService(TelegramMessage as any, logger, hooks);

      (TelegramMessage.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 2 });

      await serviceWithHooks.markAsRead('chat-1');

      expect(onMessageRead).toHaveBeenCalledWith({
        messageId: 'all',
        chatId: 'chat-1',
        readAt: expect.any(Date),
      });
    });

    it('should not throw when onMessageRead hook throws', async () => {
      const onMessageRead = vi.fn().mockImplementation(() => { throw new Error('hook error'); });
      const hooks = { onMessageRead };
      const serviceWithHooks = new ConversationService(TelegramMessage as any, logger, hooks);

      (TelegramMessage.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 1 });

      await expect(serviceWithHooks.markAsRead('chat-1')).resolves.toBe(1);
    });
  });

  describe('getUnreadCount()', () => {
    it('should return unread count for a specific conversation', async () => {
      (TelegramMessage.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(7);

      const result = await service.getUnreadCount('chat-1');

      expect(result).toBe(7);
      expect(TelegramMessage.countDocuments).toHaveBeenCalledWith({
        direction: 'inbound',
        readAt: null,
        conversationId: 'chat-1',
      });
    });

    it('should return global unread count when no conversationId', async () => {
      (TelegramMessage.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(15);

      const result = await service.getUnreadCount();

      expect(result).toBe(15);
      expect(TelegramMessage.countDocuments).toHaveBeenCalledWith({
        direction: 'inbound',
        readAt: null,
      });
    });

    it('should return 0 when no unread messages', async () => {
      (TelegramMessage.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await service.getUnreadCount('chat-1');

      expect(result).toBe(0);
    });
  });
});
