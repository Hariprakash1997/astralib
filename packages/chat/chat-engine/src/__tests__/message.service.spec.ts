import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageService } from '../services/message.service';
import { ChatSenderType, ChatContentType, ChatMessageStatus } from '@astralibx/chat-types';
import type { ChatMessageModel } from '../schemas/chat-message.schema';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockMessageModel() {
  return {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  } as unknown as ChatMessageModel;
}

function createMockMessage(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'msg-id' },
    messageId: 'msg-1',
    sessionId: 'sess-1',
    senderType: ChatSenderType.Visitor,
    senderName: 'Visitor',
    content: 'Hello',
    contentType: ChatContentType.Text,
    status: ChatMessageStatus.Sent,
    metadata: {},
    createdAt: new Date(),
    ...overrides,
  };
}

describe('MessageService', () => {
  let service: MessageService;
  let model: ChatMessageModel;
  let logger: LogAdapter;
  let hooks: any;

  beforeEach(() => {
    model = createMockMessageModel();
    logger = createMockLogger();
    hooks = { onMessageSent: vi.fn() };
    service = new MessageService(model, DEFAULT_OPTIONS, logger, hooks);
  });

  describe('create()', () => {
    it('should create a message with correct defaults', async () => {
      const mockMsg = createMockMessage();
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockMsg);

      const result = await service.create({
        sessionId: 'sess-1',
        senderType: ChatSenderType.Visitor,
        content: 'Hello',
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          senderType: ChatSenderType.Visitor,
          content: 'Hello',
          contentType: ChatContentType.Text,
          status: ChatMessageStatus.Sent,
        }),
      );
      expect(result).toBe(mockMsg);
      expect(hooks.onMessageSent).toHaveBeenCalled();
    });

    it('should use provided contentType', async () => {
      const mockMsg = createMockMessage({ contentType: ChatContentType.Image });
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockMsg);

      await service.create({
        sessionId: 'sess-1',
        senderType: ChatSenderType.Visitor,
        content: 'image.png',
        contentType: ChatContentType.Image,
      });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ contentType: ChatContentType.Image }),
      );
    });
  });

  describe('createSystemMessage()', () => {
    it('should create a system message with correct sender type', async () => {
      const mockMsg = createMockMessage({ senderType: ChatSenderType.System });
      (model.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockMsg);

      const result = await service.createSystemMessage('sess-1', 'Agent joined');
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          senderType: ChatSenderType.System,
          senderName: 'System',
          contentType: ChatContentType.System,
          content: 'Agent joined',
        }),
      );
      expect(result).toBe(mockMsg);
    });
  });

  describe('findBySession()', () => {
    function mockQueryChain(resolvedValue: any[]) {
      // Simulate Mongoose Query: find().sort() returns query, query.limit() returns query,
      // await query resolves to the result array
      const query: any = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: (v: any) => void) => resolve([...resolvedValue]),
      };
      return query;
    }

    it('should query messages by sessionId with default sort', async () => {
      const mockMessages = [createMockMessage()];
      (model.find as ReturnType<typeof vi.fn>).mockReturnValue(mockQueryChain(mockMessages));

      const result = await service.findBySession('sess-1', 50);

      expect(model.find).toHaveBeenCalledWith({ sessionId: 'sess-1' });
      expect(result).toHaveLength(1);
    });

    it('should apply cursor-based filter when before is provided', async () => {
      const cursorDate = new Date('2025-01-01');
      const cursorMsg = createMockMessage({ createdAt: cursorDate });
      (model.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(cursorMsg);

      const mockMessages = [createMockMessage()];
      (model.find as ReturnType<typeof vi.fn>).mockReturnValue(mockQueryChain(mockMessages));

      await service.findBySession('sess-1', 50, 'cursor-msg-id');

      expect(model.findOne).toHaveBeenCalledWith({ messageId: 'cursor-msg-id' });
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          createdAt: { $lt: cursorDate },
        }),
      );
    });
  });

  describe('markDelivered()', () => {
    it('should update message status to Delivered', async () => {
      await service.markDelivered('msg-1');

      expect(model.updateOne).toHaveBeenCalledWith(
        { messageId: 'msg-1' },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: ChatMessageStatus.Delivered,
            deliveredAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('markRead()', () => {
    it('should update multiple messages to Read', async () => {
      await service.markRead(['msg-1', 'msg-2']);

      expect(model.updateMany).toHaveBeenCalledWith(
        { messageId: { $in: ['msg-1', 'msg-2'] } },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: ChatMessageStatus.Read,
          }),
        }),
      );
    });

    it('should skip when array is empty', async () => {
      await service.markRead([]);
      expect(model.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('toPayload()', () => {
    it('should map document to payload', () => {
      const msg = createMockMessage();
      const payload = service.toPayload(msg as any);

      expect(payload.messageId).toBe('msg-1');
      expect(payload.sessionId).toBe('sess-1');
      expect(payload.content).toBe('Hello');
    });
  });
});
