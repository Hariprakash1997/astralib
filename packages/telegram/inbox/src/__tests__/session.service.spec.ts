import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../services/session.service';
import type { TelegramConversationSessionModel } from '../schemas/telegram-conversation-session.schema';

function createMockSessionModel() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  } as unknown as TelegramConversationSessionModel;
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('SessionService', () => {
  let service: SessionService;
  let TelegramConversationSession: ReturnType<typeof createMockSessionModel>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    TelegramConversationSession = createMockSessionModel();
    logger = createMockLogger();
    service = new SessionService(TelegramConversationSession as any, logger);
  });

  describe('create()', () => {
    it('should create a new session with active status and defaults', async () => {
      const input = { accountId: 'acc-1', contactId: 'contact-1', conversationId: 'chat-123', identifierId: 'ident-1' };
      const createdDoc = {
        ...input,
        status: 'active',
        startedAt: new Date(),
        messageCount: 0,
        _id: { toString: () => 'session-1' },
      };
      (TelegramConversationSession.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDoc);

      const result = await service.create(input);

      expect(TelegramConversationSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc-1',
          contactId: 'contact-1',
          identifierId: 'ident-1',
          conversationId: 'chat-123',
          status: 'active',
          messageCount: 0,
          startedAt: expect.any(Date),
        }),
      );
      expect(result).toEqual(createdDoc);
    });

    it('should log session creation', async () => {
      const createdDoc = {
        _id: { toString: () => 'session-1' },
        accountId: 'acc-1',
        contactId: 'contact-1',
      };
      (TelegramConversationSession.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDoc);

      await service.create({ accountId: 'acc-1', contactId: 'contact-1', conversationId: 'chat-1' });

      expect(logger.info).toHaveBeenCalledWith('Session created', {
        id: 'session-1',
        accountId: 'acc-1',
        contactId: 'contact-1',
      });
    });

    it('should use provided conversationId instead of generating one', async () => {
      const createdDoc = {
        _id: { toString: () => 'session-1' },
        conversationId: 'chat-789',
      };
      (TelegramConversationSession.create as ReturnType<typeof vi.fn>).mockResolvedValue(createdDoc);

      await service.create({ accountId: 'acc-X', contactId: 'contact-Y', conversationId: 'chat-789' });

      const createCall = (TelegramConversationSession.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.conversationId).toBe('chat-789');
    });
  });

  describe('getById()', () => {
    it('should return session when found by ID', async () => {
      const doc = { _id: 'session-1', accountId: 'acc-1', status: 'active' };
      (TelegramConversationSession.findById as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.getById('session-1');

      expect(TelegramConversationSession.findById).toHaveBeenCalledWith('session-1');
      expect(result).toEqual(doc);
    });

    it('should return null when not found', async () => {
      (TelegramConversationSession.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('list()', () => {
    it('should return paginated results with total', async () => {
      const items = [
        { _id: 'session-1', accountId: 'acc-1', status: 'active' },
        { _id: 'session-2', accountId: 'acc-2', status: 'active' },
      ];

      (TelegramConversationSession.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(items),
          }),
        }),
      });
      (TelegramConversationSession.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(10);

      const result = await service.list({}, 1, 50);

      expect(result.items).toEqual(items);
      expect(result.total).toBe(10);
    });

    it('should apply accountId filter', async () => {
      (TelegramConversationSession.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (TelegramConversationSession.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.list({ accountId: 'acc-1' }, 1, 50);

      expect(TelegramConversationSession.find).toHaveBeenCalledWith({ accountId: 'acc-1' });
    });

    it('should apply contactId filter', async () => {
      (TelegramConversationSession.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (TelegramConversationSession.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.list({ contactId: 'contact-1' }, 1, 50);

      expect(TelegramConversationSession.find).toHaveBeenCalledWith({ contactId: 'contact-1' });
    });

    it('should apply status filter', async () => {
      (TelegramConversationSession.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (TelegramConversationSession.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await service.list({ status: 'paused' }, 1, 50);

      expect(TelegramConversationSession.find).toHaveBeenCalledWith({ status: 'paused' });
    });
  });

  describe('getActiveByContact()', () => {
    it('should return active session for contact', async () => {
      const doc = { _id: 'session-1', contactId: 'contact-1', status: 'active' };
      (TelegramConversationSession.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.getActiveByContact('contact-1');

      expect(TelegramConversationSession.findOne).toHaveBeenCalledWith({
        contactId: 'contact-1',
        status: 'active',
      });
      expect(result).toEqual(doc);
    });

    it('should return null when no active session', async () => {
      (TelegramConversationSession.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getActiveByContact('contact-1');

      expect(result).toBeNull();
    });
  });

  describe('getByConversation()', () => {
    it('should return session when found by conversationId', async () => {
      const doc = { _id: 'session-1', conversationId: 'conv-1', status: 'active' };
      (TelegramConversationSession.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(doc);

      const result = await service.getByConversation('conv-1');

      expect(TelegramConversationSession.findOne).toHaveBeenCalledWith({ conversationId: 'conv-1' });
      expect(result).toEqual(doc);
    });

    it('should return null when not found', async () => {
      (TelegramConversationSession.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getByConversation('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('pause()', () => {
    it('should set status to paused', async () => {
      const updatedDoc = { _id: 'session-1', status: 'paused' };
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedDoc);

      const result = await service.pause('session-1');

      expect(TelegramConversationSession.findByIdAndUpdate).toHaveBeenCalledWith(
        'session-1',
        { $set: { status: 'paused' } },
        { new: true },
      );
      expect(result).toEqual(updatedDoc);
    });

    it('should log when session is paused', async () => {
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'session-1' });

      await service.pause('session-1');

      expect(logger.info).toHaveBeenCalledWith('Session paused', { id: 'session-1' });
    });

    it('should return null when session not found', async () => {
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.pause('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('close()', () => {
    it('should set status to closed and endedAt', async () => {
      const updatedDoc = { _id: 'session-1', status: 'closed', endedAt: new Date() };
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedDoc);

      const result = await service.close('session-1');

      expect(TelegramConversationSession.findByIdAndUpdate).toHaveBeenCalledWith(
        'session-1',
        { $set: { status: 'closed', endedAt: expect.any(Date) } },
        { new: true },
      );
      expect(result).toEqual(updatedDoc);
    });

    it('should log when session is closed', async () => {
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'session-1' });

      await service.close('session-1');

      expect(logger.info).toHaveBeenCalledWith('Session closed', { id: 'session-1' });
    });

    it('should return null when session not found', async () => {
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.close('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('resume()', () => {
    it('should set status to active and unset endedAt', async () => {
      const updatedDoc = { _id: 'session-1', status: 'active' };
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedDoc);

      const result = await service.resume('session-1');

      expect(TelegramConversationSession.findByIdAndUpdate).toHaveBeenCalledWith(
        'session-1',
        { $set: { status: 'active' }, $unset: { endedAt: 1 } },
        { new: true },
      );
      expect(result).toEqual(updatedDoc);
    });

    it('should log when session is resumed', async () => {
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'session-1' });

      await service.resume('session-1');

      expect(logger.info).toHaveBeenCalledWith('Session resumed', { id: 'session-1' });
    });

    it('should return null when session not found', async () => {
      (TelegramConversationSession.findByIdAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.resume('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('incrementMessageCount()', () => {
    it('should atomically increment messageCount and update lastMessageAt', async () => {
      const updatedDoc = { _id: 'session-1', messageCount: 6 };
      (TelegramConversationSession.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(updatedDoc);

      const result = await service.incrementMessageCount('conv-1');

      expect(TelegramConversationSession.findOneAndUpdate).toHaveBeenCalledWith(
        { conversationId: 'conv-1', status: 'active' },
        {
          $inc: { messageCount: 1 },
          $set: { lastMessageAt: expect.any(Date) },
        },
        { new: true },
      );
      expect(result).toEqual(updatedDoc);
    });

    it('should return null when no active session for conversation', async () => {
      (TelegramConversationSession.findOneAndUpdate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.incrementMessageCount('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('delete()', () => {
    it('should delete and return true when found', async () => {
      (TelegramConversationSession.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'session-1' });

      const result = await service.delete('session-1');

      expect(TelegramConversationSession.findByIdAndDelete).toHaveBeenCalledWith('session-1');
      expect(result).toBe(true);
    });

    it('should log on successful deletion', async () => {
      (TelegramConversationSession.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'session-1' });

      await service.delete('session-1');

      expect(logger.info).toHaveBeenCalledWith('Session deleted', { id: 'session-1' });
    });

    it('should return false when session not found', async () => {
      (TelegramConversationSession.findByIdAndDelete as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
