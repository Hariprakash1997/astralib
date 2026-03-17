import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HistorySyncService } from '../services/history-sync.service';
import type { SyncResult } from '../services/history-sync.service';

// Define MockMessage inside the factory so vi.mock hoisting doesn't cause reference errors
const MockMessageClass = (() => {
  class M {
    id: number;
    message: string;
    out: boolean;
    media: null;
    constructor(id: number, message: string, out = false) {
      this.id = id;
      this.message = message;
      this.out = out;
      this.media = null;
    }
  }
  return M;
})();

vi.mock('telegram', () => {
  class MockMessage {
    id: number;
    message: string;
    out: boolean;
    media: null;
    constructor(id: number, message: string, out = false) {
      this.id = id;
      this.message = message;
      this.out = out;
      this.media = null;
    }
  }
  return {
    Api: {
      Message: MockMessage,
      MessageMediaPhoto: class {},
      MessageMediaDocument: class {},
      MessageMediaGeo: class {},
      MessageMediaGeoLive: class {},
      MessageMediaContact: class {},
      Document: class {},
    },
  };
});

// We need to get Api.Message from the mocked module for instanceof checks to work
let ApiMessage: any;

function createMockAccountManager() {
  return {
    getClient: vi.fn(),
  };
}

function createMockMessageModel() {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((data: any) => Promise.resolve({ _id: 'msg-1', ...data })),
  };
}

function createMockConfig() {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    options: { historySyncLimit: 50 },
  };
}

function createService(
  accountManager = createMockAccountManager(),
  messageModel = createMockMessageModel(),
  config = createMockConfig(),
) {
  return {
    service: new HistorySyncService(accountManager as any, messageModel as any, config as any, config.logger),
    accountManager,
    messageModel,
    config,
  };
}

function makeMessage(id: number, message: string, out = false) {
  // Use the mocked Api.Message so instanceof checks pass in the service
  return new ApiMessage(id, message, out);
}

describe('HistorySyncService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const telegram = await import('telegram');
    ApiMessage = (telegram.Api as any).Message;
  });

  describe('syncChat()', () => {
    it('should fetch messages via client.getMessages, save to DB, return sync result', async () => {
      const mockClient = {
        getMessages: vi.fn().mockResolvedValue([
          makeMessage(1, 'Hello'),
          makeMessage(2, 'World', true),
        ]),
      };

      const { service, accountManager, messageModel } = createService();
      accountManager.getClient.mockReturnValue(mockClient);

      const result: SyncResult = await service.syncChat('acc-1', 'chat-1', 10);

      expect(accountManager.getClient).toHaveBeenCalledWith('acc-1');
      expect(mockClient.getMessages).toHaveBeenCalledWith('chat-1', { limit: 10, reverse: false });
      expect(messageModel.create).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.messagesImported).toBe(2);
    });

    it('should return error result when client not connected', async () => {
      const { service, accountManager } = createService();
      accountManager.getClient.mockReturnValue(null);

      const result = await service.syncChat('acc-1', 'chat-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account not connected');
    });

    it('should return already-syncing error when sync already in progress', async () => {
      const mockClient = {
        getMessages: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 100))),
      };

      const { service, accountManager } = createService();
      accountManager.getClient.mockReturnValue(mockClient);

      // Start first sync (don't await)
      const firstSync = service.syncChat('acc-1', 'chat-1');

      // Attempt second sync on same chat
      const secondResult = await service.syncChat('acc-1', 'chat-1');

      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe('Sync already in progress');

      // Clean up
      await firstSync;
    });

    it('should skip messages that already exist (dedup)', async () => {
      const mockClient = {
        getMessages: vi.fn().mockResolvedValue([
          makeMessage(1, 'Existing'),
          makeMessage(2, 'New'),
        ]),
      };

      const { service, accountManager, messageModel } = createService();
      accountManager.getClient.mockReturnValue(mockClient);

      // First message already exists
      messageModel.findOne
        .mockResolvedValueOnce({ _id: 'existing' }) // msg 1 exists
        .mockResolvedValueOnce(null); // msg 2 is new

      const result = await service.syncChat('acc-1', 'chat-1');

      expect(messageModel.create).toHaveBeenCalledTimes(1);
      expect(result.messagesImported).toBe(1);
    });

    it('should use default limit from config when no limit provided', async () => {
      const mockClient = {
        getMessages: vi.fn().mockResolvedValue([]),
      };

      const { service, accountManager } = createService();
      accountManager.getClient.mockReturnValue(mockClient);

      await service.syncChat('acc-1', 'chat-1');

      expect(mockClient.getMessages).toHaveBeenCalledWith('chat-1', { limit: 50, reverse: false });
    });

    it('should set hasMore=true when messages.length >= limit', async () => {
      const messages = Array.from({ length: 5 }, (_, i) => makeMessage(i + 1, `msg-${i}`));
      const mockClient = {
        getMessages: vi.fn().mockResolvedValue(messages),
      };

      const { service, accountManager } = createService();
      accountManager.getClient.mockReturnValue(mockClient);

      const result = await service.syncChat('acc-1', 'chat-1', 5);

      expect(result.hasMore).toBe(true);
    });
  });

  describe('isSyncing()', () => {
    it('should return true during sync, false otherwise', async () => {
      let resolveMessages: (value: any) => void;
      const messagePromise = new Promise((resolve) => {
        resolveMessages = resolve;
      });

      const mockClient = {
        getMessages: vi.fn().mockReturnValue(messagePromise),
      };

      const { service, accountManager } = createService();
      accountManager.getClient.mockReturnValue(mockClient);

      expect(service.isSyncing('chat-1')).toBe(false);

      const syncPromise = service.syncChat('acc-1', 'chat-1');
      expect(service.isSyncing('chat-1')).toBe(true);

      resolveMessages!([]);
      await syncPromise;

      expect(service.isSyncing('chat-1')).toBe(false);
    });
  });
});
