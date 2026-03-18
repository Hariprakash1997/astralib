import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../services/session.service';
import { ChatSessionStatus, SessionMode, ChatSenderType } from '@astralibx/chat-types';
import type { ChatSessionModel } from '../schemas/chat-session.schema';
import type { ChatMessageModel } from '../schemas/chat-message.schema';
import type { ResolvedOptions } from '../types/config.types';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';

function createMockLogger(): LogAdapter {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createMockSessionModel() {
  return {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }),
    countDocuments: vi.fn().mockResolvedValue(0),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    distinct: vi.fn().mockResolvedValue([]),
  } as unknown as ChatSessionModel;
}

function createMockMessageModel() {
  return {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          sort: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    countDocuments: vi.fn().mockResolvedValue(0),
  } as unknown as ChatMessageModel;
}

function createMockSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'sess-1',
    visitorId: 'vis-1',
    status: ChatSessionStatus.Active,
    mode: SessionMode.AI,
    channel: 'web',
    messageCount: 0,
    startedAt: new Date(),
    metadata: {},
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SessionService', () => {
  let service: SessionService;
  let sessionModel: ChatSessionModel;
  let messageModel: ChatMessageModel;
  let logger: LogAdapter;
  let hooks: any;

  beforeEach(() => {
    sessionModel = createMockSessionModel();
    messageModel = createMockMessageModel();
    logger = createMockLogger();
    hooks = {
      onSessionCreated: vi.fn(),
      onSessionResolved: vi.fn(),
      onSessionAbandoned: vi.fn(),
      onFeedbackReceived: vi.fn(),
    };
    service = new SessionService(sessionModel, messageModel, DEFAULT_OPTIONS, logger, hooks);
  });

  describe('create()', () => {
    it('should create a new session with correct defaults', async () => {
      const mockSession = createMockSession();
      (sessionModel.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const context = { visitorId: 'vis-1', channel: 'web' };
      const result = await service.create(context, SessionMode.AI);

      expect(sessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visitorId: 'vis-1',
          status: ChatSessionStatus.New,
          mode: SessionMode.AI,
          channel: 'web',
          messageCount: 0,
        }),
      );
      expect(result).toBe(mockSession);
      expect(hooks.onSessionCreated).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Session created', expect.any(Object));
    });
  });

  describe('findById()', () => {
    it('should return session when found', async () => {
      const mockSession = createMockSession();
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await service.findById('sess-1');
      expect(sessionModel.findOne).toHaveBeenCalledWith({ sessionId: 'sess-1' });
      expect(result).toBe(mockSession);
    });

    it('should return null when not found', async () => {
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail()', () => {
    it('should throw SessionNotFoundError when session does not exist', async () => {
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.findByIdOrFail('nonexistent')).rejects.toThrow('Session not found');
    });
  });

  describe('resolve()', () => {
    it('should set session status to Resolved and call hook', async () => {
      const mockSession = createMockSession();
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      // Mock getSessionStats dependency
      (messageModel.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await service.resolve('sess-1');
      expect(result.status).toBe(ChatSessionStatus.Resolved);
      expect(result.endedAt).toBeInstanceOf(Date);
      expect(mockSession.save).toHaveBeenCalled();
      expect(hooks.onSessionResolved).toHaveBeenCalled();
    });
  });

  describe('abandon()', () => {
    it('should set session status to Abandoned', async () => {
      const mockSession = createMockSession();
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await service.abandon('sess-1');
      expect(result.status).toBe(ChatSessionStatus.Abandoned);
      expect(result.endedAt).toBeInstanceOf(Date);
      expect(hooks.onSessionAbandoned).toHaveBeenCalled();
    });
  });

  describe('transfer()', () => {
    it('should update agentId and transferredFrom fields', async () => {
      const mockSession = createMockSession({ agentId: 'agent-1' });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const result = await service.transfer('sess-1', 'agent-2', 'Needs specialist');
      expect(result.agentId).toBe('agent-2');
      expect(result.transferredFrom).toBe('agent-1');
      expect(result.transferNote).toBe('Needs specialist');
    });
  });

  describe('submitFeedback()', () => {
    it('should update session with feedback and call hook', async () => {
      const feedback = { rating: 5, survey: { comment: 'Great!' } };
      await service.submitFeedback('sess-1', feedback);

      expect(sessionModel.updateOne).toHaveBeenCalledWith(
        { sessionId: 'sess-1' },
        expect.objectContaining({
          $set: expect.objectContaining({
            feedback: expect.objectContaining({
              rating: 5,
              submittedAt: expect.any(Date),
            }),
          }),
        }),
      );
      expect(hooks.onFeedbackReceived).toHaveBeenCalledWith('sess-1', feedback);
    });
  });

  describe('findOrCreate()', () => {
    it('should create a new session when no existing session found', async () => {
      // No existingSessionId provided, so first findOne is the "recent session" search (line 78)
      // which chains .sort()
      (sessionModel.findOne as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({ sort: vi.fn().mockResolvedValue(null) }); // no recent session

      const newSession = createMockSession();
      (sessionModel.create as ReturnType<typeof vi.fn>).mockResolvedValue(newSession);

      const context = { visitorId: 'vis-1', channel: 'web' };
      const result = await service.findOrCreate(context);

      expect(result.isNew).toBe(true);
      expect(result.messages).toEqual([]);
    });

    it('should resume existing active session by visitor', async () => {
      const existingSession = createMockSession();
      // First call for existingSessionId lookup, second for visitor active session lookup
      (sessionModel.findOne as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // no existing by sessionId
        .mockReturnValueOnce({
          sort: vi.fn().mockResolvedValue(existingSession),
        });

      (messageModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const context = { visitorId: 'vis-1', channel: 'web' };
      const result = await service.findOrCreate(context, 'nonexistent');

      expect(result.isNew).toBe(false);
    });

    it('should prevent concurrent sessions by returning existing active session for same visitorId (Gap 18)', async () => {
      const existingSession = createMockSession({ visitorId: 'vis-1', status: ChatSessionStatus.Active });

      // No existingSessionId provided, so it searches by visitorId for active sessions
      (sessionModel.findOne as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({
          sort: vi.fn().mockResolvedValue(existingSession),
        });

      (messageModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const context = { visitorId: 'vis-1', channel: 'web' };
      const result = await service.findOrCreate(context);

      expect(result.isNew).toBe(false);
      expect(result.session.visitorId).toBe('vis-1');
      expect(sessionModel.create).not.toHaveBeenCalled();
    });

    it('should return the same session for concurrent connections from the same visitor (Gap 18)', async () => {
      const existingSession = createMockSession({ sessionId: 'sess-shared', visitorId: 'vis-1', status: ChatSessionStatus.WithAgent });

      // Both calls should find the same active session
      (sessionModel.findOne as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({ sort: vi.fn().mockResolvedValue(existingSession) })
        .mockReturnValueOnce({ sort: vi.fn().mockResolvedValue(existingSession) });

      (messageModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const context = { visitorId: 'vis-1', channel: 'web' };
      const [result1, result2] = await Promise.all([
        service.findOrCreate(context),
        service.findOrCreate(context),
      ]);

      expect(result1.session.sessionId).toBe('sess-shared');
      expect(result2.session.sessionId).toBe('sess-shared');
      expect(result1.isNew).toBe(false);
      expect(result2.isNew).toBe(false);
    });
  });

  describe('findPaginated()', () => {
    it('should return paginated results with total count', async () => {
      const mockSessions = [createMockSession()];
      const sortFn = vi.fn().mockReturnThis();
      const skipFn = vi.fn().mockReturnThis();
      const limitFn = vi.fn().mockResolvedValue(mockSessions);

      (sessionModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: sortFn,
      });
      sortFn.mockReturnValue({ skip: skipFn });
      skipFn.mockReturnValue({ limit: limitFn });
      (sessionModel.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await service.findPaginated({}, 1, 20);

      expect(result).toEqual({
        sessions: mockSessions,
        total: 1,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('getDashboardStats()', () => {
    it('should return aggregate session counts', async () => {
      (sessionModel.countDocuments as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5)  // active
        .mockResolvedValueOnce(2)  // waiting
        .mockResolvedValueOnce(10); // resolved today

      const result = await service.getDashboardStats();

      expect(result.activeSessions).toBe(5);
      expect(result.waitingSessions).toBe(2);
      expect(result.resolvedToday).toBe(10);
    });
  });

  describe('updateMetadata()', () => {
    it('should merge metadata on session', async () => {
      const mockSession = createMockSession({ metadata: { existing: 'value' } });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      await service.updateMetadata('sess-1', { trainingQuality: 'good' });

      expect(mockSession.metadata).toEqual({ existing: 'value', trainingQuality: 'good' });
      expect(mockSession.save).toHaveBeenCalled();
    });
  });

  describe('recalculateQueuePositions()', () => {
    it('should update positions for sessions after fromPosition', async () => {
      const waitingSessions = [
        { _id: 'id-2', sessionId: 'sess-2', queuePosition: 3 },
        { _id: 'id-3', sessionId: 'sess-3', queuePosition: 4 },
      ];
      (sessionModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue(waitingSessions),
      });

      const result = await service.recalculateQueuePositions(2);

      expect(sessionModel.find).toHaveBeenCalledWith({
        status: ChatSessionStatus.WaitingAgent,
        queuePosition: { $gt: 2 },
      });
      expect(sessionModel.updateOne).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        { sessionId: 'sess-2', queuePosition: 2 },
        { sessionId: 'sess-3', queuePosition: 3 },
      ]);
    });

    it('should return empty array when no sessions to update', async () => {
      (sessionModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const result = await service.recalculateQueuePositions(1);
      expect(result).toEqual([]);
    });
  });

  describe('toSummary()', () => {
    it('should map session document to summary', () => {
      const session = createMockSession({
        sessionId: 'sess-1',
        status: ChatSessionStatus.Active,
        mode: SessionMode.AI,
        visitorId: 'vis-1',
        channel: 'web',
        messageCount: 5,
      });

      const summary = service.toSummary(session as any);

      expect(summary.sessionId).toBe('sess-1');
      expect(summary.status).toBe(ChatSessionStatus.Active);
      expect(summary.visitorId).toBe('vis-1');
      expect(summary.messageCount).toBe(5);
    });
  });

  describe('getSessionContext()', () => {
    it('should return session context with messages and metadata', async () => {
      const mockSession = createMockSession({
        visitorId: 'vis-1',
        preferences: { lang: 'en' },
        conversationSummary: 'User asked about billing',
        feedback: { rating: 5 },
        metadata: { source: 'web' },
      });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const mockMessages = [{ messageId: 'msg-1', content: 'Hello' }];
      (messageModel.find as ReturnType<typeof vi.fn>).mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockMessages),
      });

      const context = await service.getSessionContext('sess-1');

      expect(context.visitorId).toBe('vis-1');
      expect(context.messages).toEqual(mockMessages);
      expect(context.preferences).toEqual({ lang: 'en' });
      expect(context.conversationSummary).toBe('User asked about billing');
      expect(context.feedback).toEqual({ rating: 5 });
      expect(context.metadata).toEqual({ source: 'web' });
      expect(context.session).toBeDefined();
    });

    it('should throw when session not found', async () => {
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.getSessionContext('nonexistent')).rejects.toThrow('Session not found');
    });
  });
});
