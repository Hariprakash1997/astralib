import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../services/session.service';
import { ChatSessionStatus, SessionMode } from '@astralibx/chat-types';
import type { ChatSessionModel } from '../schemas/chat-session.schema';
import type { ChatMessageModel } from '../schemas/chat-message.schema';
import { DEFAULT_OPTIONS } from '../types/config.types';
import type { LogAdapter } from '@astralibx/core';
import { SessionNotFoundError, InvalidConfigError } from '../errors';

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
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
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
    tags: [],
    agentNotes: [],
    userInfo: null,
    userCategory: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SessionService — User Features', () => {
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

  // ── Tags ──────────────────────────────────────────────────────────────

  describe('addTag()', () => {
    it('should add a tag to the session', async () => {
      const session = createMockSession({ tags: ['existing'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.addTag('sess-1', 'vip');

      expect(result).toContain('vip');
      expect(result).toContain('existing');
      expect(session.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Tag added', { sessionId: 'sess-1', tag: 'vip' });
    });

    it('should not add duplicate tags', async () => {
      const session = createMockSession({ tags: ['vip'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.addTag('sess-1', 'vip');

      expect(result).toEqual(['vip']);
      // save is NOT called for the duplicate push, but info is still logged
    });

    it('should throw SessionNotFoundError when session does not exist', async () => {
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.addTag('nonexistent', 'tag')).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('removeTag()', () => {
    it('should remove a tag from the session', async () => {
      const session = createMockSession({ tags: ['vip', 'urgent'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.removeTag('sess-1', 'vip');

      expect(result).toEqual(['urgent']);
      expect(session.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Tag removed', { sessionId: 'sess-1', tag: 'vip' });
    });

    it('should return unchanged tags when tag does not exist', async () => {
      const session = createMockSession({ tags: ['existing'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.removeTag('sess-1', 'nonexistent');

      expect(result).toEqual(['existing']);
      expect(session.save).toHaveBeenCalled();
    });
  });

  describe('getTags()', () => {
    it('should return tags for the session', async () => {
      const session = createMockSession({ tags: ['vip', 'urgent'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.getTags('sess-1');
      expect(result).toEqual(['vip', 'urgent']);
    });
  });

  // ── User Category ─────────────────────────────────────────────────────

  describe('setUserCategory()', () => {
    it('should set user category on session', async () => {
      const session = createMockSession();
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.setUserCategory('sess-1', 'premium');

      expect(result).toBe('premium');
      expect(session.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('User category set', { sessionId: 'sess-1', category: 'premium' });
    });

    it('should clear user category when null is passed', async () => {
      const session = createMockSession({ userCategory: 'premium' });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.setUserCategory('sess-1', null);

      expect(result).toBeNull();
      expect(session.save).toHaveBeenCalled();
    });

    it('should validate category against available categories when settingsService is provided', async () => {
      const session = createMockSession();
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const mockSettingsService = {
        get: vi.fn().mockResolvedValue({
          availableUserCategories: ['premium', 'enterprise'],
        }),
      };

      await expect(
        service.setUserCategory('sess-1', 'invalid-category', mockSettingsService as any),
      ).rejects.toThrow(InvalidConfigError);
    });

    it('should accept valid category from available categories list', async () => {
      const session = createMockSession();
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const mockSettingsService = {
        get: vi.fn().mockResolvedValue({
          availableUserCategories: ['premium', 'enterprise'],
        }),
      };

      const result = await service.setUserCategory('sess-1', 'premium', mockSettingsService as any);
      expect(result).toBe('premium');
    });

    it('should skip validation when available categories list is empty', async () => {
      const session = createMockSession();
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const mockSettingsService = {
        get: vi.fn().mockResolvedValue({
          availableUserCategories: [],
        }),
      };

      const result = await service.setUserCategory('sess-1', 'any-category', mockSettingsService as any);
      expect(result).toBe('any-category');
    });
  });

  // ── User Info ─────────────────────────────────────────────────────────

  describe('updateUserInfo()', () => {
    it('should set name, email, and mobile', async () => {
      const session = createMockSession({ userInfo: null });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.updateUserInfo('sess-1', {
        name: 'Alice',
        email: 'alice@example.com',
        mobile: '+1234567890',
      });

      expect(result.userInfo).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
        mobile: '+1234567890',
      });
      expect(session.save).toHaveBeenCalled();
    });

    it('should partially update user info preserving existing fields', async () => {
      const session = createMockSession({
        userInfo: { name: 'Alice', email: 'old@example.com', mobile: null },
      });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.updateUserInfo('sess-1', { email: 'new@example.com' });

      expect(result.userInfo).toEqual({
        name: 'Alice',
        email: 'new@example.com',
        mobile: null,
      });
    });

    it('should throw SessionNotFoundError when session does not exist', async () => {
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.updateUserInfo('nonexistent', { name: 'Alice' })).rejects.toThrow(SessionNotFoundError);
    });
  });

  // ── Agent Notes ───────────────────────────────────────────────────────

  describe('addNote()', () => {
    it('should append a note and return all notes', async () => {
      const session = createMockSession({ agentNotes: ['first note'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.addNote('sess-1', 'second note');

      expect(result).toEqual(['first note', 'second note']);
      expect(session.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Note added', { sessionId: 'sess-1' });
    });
  });

  describe('removeNote()', () => {
    it('should remove note at given index', async () => {
      const session = createMockSession({ agentNotes: ['note-0', 'note-1', 'note-2'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.removeNote('sess-1', 1);

      expect(result).toEqual(['note-0', 'note-2']);
      expect(session.save).toHaveBeenCalled();
    });

    it('should throw when index is out of range (negative)', async () => {
      const session = createMockSession({ agentNotes: ['note'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      await expect(service.removeNote('sess-1', -1)).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw when index is beyond length', async () => {
      const session = createMockSession({ agentNotes: ['note'] });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      await expect(service.removeNote('sess-1', 5)).rejects.toThrow(SessionNotFoundError);
    });
  });

  // ── User History ──────────────────────────────────────────────────────

  describe('getUserHistory()', () => {
    it('should return sessions for a visitor sorted by startedAt desc', async () => {
      const sessions = [createMockSession({ sessionId: 'sess-1' }), createMockSession({ sessionId: 'sess-2' })];
      const limitFn = vi.fn().mockResolvedValue(sessions);
      const sortFn = vi.fn().mockReturnValue({ limit: limitFn });
      (sessionModel.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: sortFn });

      const result = await service.getUserHistory('vis-1');

      expect(sessionModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          visitorId: 'vis-1',
          isDeletedForUser: { $ne: true },
        }),
      );
      expect(result).toEqual(sessions);
    });

    it('should clamp limit to max 5', async () => {
      const limitFn = vi.fn().mockResolvedValue([]);
      const sortFn = vi.fn().mockReturnValue({ limit: limitFn });
      (sessionModel.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: sortFn });

      await service.getUserHistory('vis-1', 100);

      expect(limitFn).toHaveBeenCalledWith(5);
    });

    it('should clamp limit to min 1', async () => {
      const limitFn = vi.fn().mockResolvedValue([]);
      const sortFn = vi.fn().mockReturnValue({ limit: limitFn });
      (sessionModel.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: sortFn });

      await service.getUserHistory('vis-1', 0);

      expect(limitFn).toHaveBeenCalledWith(1);
    });

    it('should default to 5 when no limit provided', async () => {
      const limitFn = vi.fn().mockResolvedValue([]);
      const sortFn = vi.fn().mockReturnValue({ limit: limitFn });
      (sessionModel.find as ReturnType<typeof vi.fn>).mockReturnValue({ sort: sortFn });

      await service.getUserHistory('vis-1');

      expect(limitFn).toHaveBeenCalledWith(5);
    });
  });

  // ── Anonymous → Logged-in Merge ───────────────────────────────────────

  describe('mergeAnonymousSessions()', () => {
    it('should update visitorId for all matching sessions', async () => {
      (sessionModel.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 3 });

      const count = await service.mergeAnonymousSessions('anon-123', 'user-456');

      expect(sessionModel.updateMany).toHaveBeenCalledWith(
        { visitorId: 'anon-123' },
        { $set: { visitorId: 'user-456' } },
      );
      expect(count).toBe(3);
      expect(logger.info).toHaveBeenCalledWith('Merged anonymous sessions', expect.objectContaining({
        anonymousId: 'anon-123',
        userId: 'user-456',
        count: 3,
      }));
    });

    it('should not log when no sessions were merged', async () => {
      (sessionModel.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ modifiedCount: 0 });

      const count = await service.mergeAnonymousSessions('anon-123', 'user-456');

      expect(count).toBe(0);
      expect(logger.info).not.toHaveBeenCalledWith('Merged anonymous sessions', expect.anything());
    });
  });

  // ── Close ─────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('should transition Resolved session to Closed', async () => {
      const session = createMockSession({ status: ChatSessionStatus.Resolved });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      const result = await service.close('sess-1');

      expect(result.status).toBe(ChatSessionStatus.Closed);
      expect(result.closedAt).toBeInstanceOf(Date);
      expect(session.save).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Session closed', { sessionId: 'sess-1' });
    });

    it('should throw for invalid transition (Active → Closed)', async () => {
      const session = createMockSession({ status: ChatSessionStatus.Active });
      (sessionModel.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(session);

      await expect(service.close('sess-1')).rejects.toThrow();
    });
  });
});
