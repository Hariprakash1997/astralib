import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserTrackerService } from '../services/user-tracker.service';

function createMockModel() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  };
}

function createMockHooks() {
  return {
    onUserStart: vi.fn(),
    onUserBlocked: vi.fn(),
    onCommand: vi.fn(),
    onError: vi.fn(),
  };
}

const testUser = {
  id: 12345,
  first_name: 'John',
  last_name: 'Doe',
  username: 'johndoe',
  language_code: 'en',
};

const botUsername = '@test_bot';
const botId = '999';

describe('UserTrackerService', () => {
  let service: UserTrackerService;
  let mockModel: ReturnType<typeof createMockModel>;
  let mockHooks: ReturnType<typeof createMockHooks>;

  beforeEach(() => {
    mockModel = createMockModel();
    mockHooks = createMockHooks();
    service = new UserTrackerService(mockModel as any, mockHooks);
  });

  describe('trackInteraction()', () => {
    it('creates a new contact for first-time user', async () => {
      mockModel.findOne.mockResolvedValue(null);
      mockModel.create.mockResolvedValue({ _id: 'new-id', telegramUserId: '12345' });

      const result = await service.trackInteraction(testUser, botUsername, botId, testUser.id);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(true);
      expect(result.contactId).toBe('new-id');
      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          telegramUserId: '12345',
          firstName: 'John',
          lastName: 'Doe',
          username: 'johndoe',
          languageCode: 'en',
        }),
      );
    });

    it('fires onUserStart hook for new user', async () => {
      mockModel.findOne.mockResolvedValue(null);
      mockModel.create.mockResolvedValue({ _id: 'new-id', telegramUserId: '12345' });

      await service.trackInteraction(testUser, botUsername, botId, testUser.id);

      expect(mockHooks.onUserStart).toHaveBeenCalledWith({
        userId: '12345',
        firstName: 'John',
        username: 'johndoe',
        chatId: 12345,
      });
    });

    it('updates existing contact on return visit', async () => {
      const existingContact = {
        _id: 'existing-id',
        telegramUserId: '12345',
        firstName: 'John',
        interactions: [
          {
            botUsername,
            botId,
            status: 'active',
            interactionCount: 5,
            lastInteractionAt: new Date('2025-01-01'),
          },
        ],
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockModel.findOne.mockResolvedValue(existingContact);

      const result = await service.trackInteraction(testUser, botUsername, botId, testUser.id);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(false);
      expect(existingContact.save).toHaveBeenCalled();
      expect(existingContact.interactions[0].interactionCount).toBe(6);
    });

    it('creates new interaction entry for existing user with different bot', async () => {
      const existingContact = {
        _id: 'existing-id',
        telegramUserId: '12345',
        firstName: 'John',
        interactions: [
          { botUsername: '@other_bot', botId: '888', status: 'active', interactionCount: 1 },
        ],
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockModel.findOne.mockResolvedValue(existingContact);

      const result = await service.trackInteraction(testUser, botUsername, botId, testUser.id);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(true);
      expect(existingContact.interactions).toHaveLength(2);
      expect(mockHooks.onUserStart).toHaveBeenCalled();
    });

    it('reactivates a blocked user on new interaction', async () => {
      const existingContact = {
        _id: 'existing-id',
        telegramUserId: '12345',
        firstName: 'John',
        interactions: [
          {
            botUsername,
            botId,
            status: 'blocked',
            interactionCount: 3,
            blockedAt: new Date(),
            blockReason: 'user_blocked',
          },
        ],
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockModel.findOne.mockResolvedValue(existingContact);

      await service.trackInteraction(testUser, botUsername, botId, testUser.id);

      expect(existingContact.interactions[0].status).toBe('active');
      expect(existingContact.interactions[0].blockedAt).toBeUndefined();
      expect(existingContact.interactions[0].blockReason).toBeUndefined();
    });

    it('returns error result on database failure', async () => {
      mockModel.findOne.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.trackInteraction(testUser, botUsername, botId, testUser.id);

      expect(result.success).toBe(false);
      expect(result.isNewUser).toBe(false);
      expect(result.error).toBe('DB connection lost');
    });

    it('handles onUserStart hook errors gracefully', async () => {
      mockModel.findOne.mockResolvedValue(null);
      mockModel.create.mockResolvedValue({ _id: 'new-id', telegramUserId: '12345' });
      mockHooks.onUserStart.mockImplementation(() => {
        throw new Error('Hook failed');
      });

      const result = await service.trackInteraction(testUser, botUsername, botId, testUser.id);

      expect(result.success).toBe(true);
      expect(result.isNewUser).toBe(true);
    });
  });

  describe('getUser()', () => {
    it('returns user by telegramUserId', async () => {
      const user = { telegramUserId: '12345', firstName: 'John' };
      mockModel.findOne.mockResolvedValue(user);

      const result = await service.getUser('12345');

      expect(result).toEqual(user);
      expect(mockModel.findOne).toHaveBeenCalledWith({ telegramUserId: '12345' });
    });

    it('returns null for non-existent user', async () => {
      mockModel.findOne.mockResolvedValue(null);

      const result = await service.getUser('99999');

      expect(result).toBeNull();
    });
  });

  describe('getAllUsers()', () => {
    it('returns users with pagination', async () => {
      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ telegramUserId: '1' }]),
      };
      mockModel.find.mockReturnValue(mockQuery);
      mockModel.countDocuments.mockResolvedValue(1);

      const result = await service.getAllUsers({}, { page: 1, limit: 20 });

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters by status', async () => {
      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockModel.find.mockReturnValue(mockQuery);
      mockModel.countDocuments.mockResolvedValue(0);

      await service.getAllUsers({ status: 'active' });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ 'interactions.status': 'active' }),
      );
    });

    it('filters by botUsername', async () => {
      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockModel.find.mockReturnValue(mockQuery);
      mockModel.countDocuments.mockResolvedValue(0);

      await service.getAllUsers({ botUsername: '@test_bot' });

      expect(mockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ 'interactions.botUsername': '@test_bot' }),
      );
    });

    it('defaults to page 1, limit 20', async () => {
      const mockQuery = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockModel.find.mockReturnValue(mockQuery);
      mockModel.countDocuments.mockResolvedValue(0);

      await service.getAllUsers();

      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
    });
  });

  describe('getUserCount()', () => {
    it('returns total user count without filter', async () => {
      mockModel.countDocuments.mockResolvedValue(42);

      const result = await service.getUserCount();

      expect(result).toBe(42);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({});
    });

    it('returns user count for specific bot', async () => {
      mockModel.countDocuments.mockResolvedValue(10);

      const result = await service.getUserCount('@test_bot');

      expect(result).toBe(10);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        'interactions.botUsername': '@test_bot',
      });
    });
  });

  describe('getActiveUsers()', () => {
    it('returns active user count', async () => {
      mockModel.countDocuments.mockResolvedValue(30);

      const result = await service.getActiveUsers();

      expect(result).toBe(30);
      expect(mockModel.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ 'interactions.status': 'active' }),
      );
    });

    it('filters by botUsername when provided using $elemMatch', async () => {
      mockModel.countDocuments.mockResolvedValue(15);

      const result = await service.getActiveUsers('@test_bot');

      expect(result).toBe(15);
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        interactions: { $elemMatch: { botUsername: '@test_bot', status: 'active' } },
      });
    });
  });

  describe('markBlocked()', () => {
    it('marks user interaction as blocked', async () => {
      const contact = {
        telegramUserId: '12345',
        interactions: [
          { botUsername, botId, status: 'active', interactionCount: 5 },
        ],
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockModel.findOne.mockResolvedValue(contact);

      const result = await service.markBlocked('12345', botUsername);

      expect(result).toBe(true);
      expect(contact.interactions[0].status).toBe('blocked');
      expect(contact.interactions[0].blockedAt).toBeInstanceOf(Date);
      expect(contact.interactions[0].blockReason).toBe('user_blocked');
      expect(contact.save).toHaveBeenCalled();
    });

    it('marks user as stopped when reason is user_deactivated', async () => {
      const contact = {
        telegramUserId: '12345',
        interactions: [
          { botUsername, botId, status: 'active', interactionCount: 5 },
        ],
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockModel.findOne.mockResolvedValue(contact);

      await service.markBlocked('12345', botUsername, 'user_deactivated');

      expect(contact.interactions[0].status).toBe('stopped');
    });

    it('fires onUserBlocked hook', async () => {
      const contact = {
        telegramUserId: '12345',
        interactions: [
          { botUsername, botId, status: 'active', interactionCount: 5 },
        ],
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockModel.findOne.mockResolvedValue(contact);

      await service.markBlocked('12345', botUsername);

      expect(mockHooks.onUserBlocked).toHaveBeenCalledWith({
        userId: '12345',
        chatId: 12345,
      });
    });

    it('returns false for non-existent user', async () => {
      mockModel.findOne.mockResolvedValue(null);

      const result = await service.markBlocked('99999', botUsername);

      expect(result).toBe(false);
    });

    it('returns false for non-existent bot interaction', async () => {
      const contact = {
        telegramUserId: '12345',
        interactions: [
          { botUsername: '@other_bot', botId: '888', status: 'active' },
        ],
        save: vi.fn(),
      };
      mockModel.findOne.mockResolvedValue(contact);

      const result = await service.markBlocked('12345', botUsername);

      expect(result).toBe(false);
    });

    it('returns false on database error', async () => {
      mockModel.findOne.mockRejectedValue(new Error('DB error'));

      const result = await service.markBlocked('12345', botUsername);

      expect(result).toBe(false);
    });
  });

  describe('isBlocked()', () => {
    it('returns true when user is blocked', async () => {
      mockModel.findOne.mockResolvedValue({ telegramUserId: '12345' });

      const result = await service.isBlocked('12345', botUsername);

      expect(result).toBe(true);
      expect(mockModel.findOne).toHaveBeenCalledWith({
        telegramUserId: '12345',
        interactions: {
          $elemMatch: {
            botUsername,
            status: { $in: ['blocked', 'stopped'] },
          },
        },
      });
    });

    it('returns false when user is not blocked', async () => {
      mockModel.findOne.mockResolvedValue(null);

      const result = await service.isBlocked('12345', botUsername);

      expect(result).toBe(false);
    });
  });

  describe('getStats()', () => {
    it('returns aggregated stats for a bot', async () => {
      mockModel.aggregate.mockResolvedValue([
        {
          totalUsers: 100,
          activeUsers: 80,
          blockedUsers: 15,
          stoppedUsers: 5,
          newUsersToday: 3,
          newUsersThisWeek: 12,
          returningUsers: 60,
        },
      ]);

      const result = await service.getStats(botUsername);

      expect(result.botUsername).toBe(botUsername);
      expect(result.totalUsers).toBe(100);
      expect(result.activeUsers).toBe(80);
      expect(result.blockedUsers).toBe(15);
      expect(result.stoppedUsers).toBe(5);
      expect(result.newUsersToday).toBe(3);
      expect(result.newUsersThisWeek).toBe(12);
      expect(result.returningUsers).toBe(60);
      expect(result.blockRate).toBe(15);
    });

    it('returns zero stats when no users exist', async () => {
      mockModel.aggregate.mockResolvedValue([]);

      const result = await service.getStats(botUsername);

      expect(result.botUsername).toBe(botUsername);
      expect(result.totalUsers).toBe(0);
      expect(result.activeUsers).toBe(0);
      expect(result.blockedUsers).toBe(0);
      expect(result.blockRate).toBe(0);
    });

    it('calculates blockRate as percentage', async () => {
      mockModel.aggregate.mockResolvedValue([
        {
          totalUsers: 200,
          activeUsers: 150,
          blockedUsers: 30,
          stoppedUsers: 20,
          newUsersToday: 0,
          newUsersThisWeek: 0,
          returningUsers: 0,
        },
      ]);

      const result = await service.getStats(botUsername);

      expect(result.blockRate).toBe(15);
    });
  });
});
