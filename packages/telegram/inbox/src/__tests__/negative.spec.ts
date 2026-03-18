import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { existsSync } from 'fs';
import { resolve } from 'path';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 });

// Mock telegram before any imports that use it
vi.mock('telegram', () => ({
  TelegramClient: vi.fn(),
  Api: { Message: class Message { constructor(public id: number, public message: string, public out: boolean) {} } },
}));
vi.mock('telegram/events', () => ({
  NewMessage: vi.fn(),
  NewMessageEvent: vi.fn(),
}));

import { createTelegramInbox, type TelegramInbox } from '../index';

const mockClient = {
  sendMessage: vi.fn().mockResolvedValue({ id: 123 }),
  getDialogs: vi.fn().mockResolvedValue([]),
  getMessages: vi.fn().mockResolvedValue([]),
  addEventHandler: vi.fn(),
  removeEventHandler: vi.fn(),
};

const mockAccountManager = {
  getClient: vi.fn().mockReturnValue(mockClient),
  getConnectedAccounts: vi.fn().mockReturnValue([
    { accountId: 'acc-1', phone: '+1234567890', name: 'Test Account', isConnected: true },
  ]),
  sendMessage: vi.fn().mockResolvedValue({ messageId: '123' }),
  connection: {} as any,
  health: { getHealth: vi.fn() } as any,
  warmup: {} as any,
  capacity: {} as any,
  identifiers: {} as any,
  quarantine: {} as any,
  sessions: {} as any,
  rotator: {} as any,
  models: {} as any,
  routes: {} as any,
  destroy: vi.fn(),
} as any;

describe('Telegram Inbox Negative / Breaking Scenarios', () => {
  let mongoServer: MongoMemoryServer;
  let connection: mongoose.Connection;
  let inbox: TelegramInbox;

  beforeAll(async () => {
    const cachedBinary = resolve(__dirname, '../../../../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-8.2.1.exe');
    const binaryOpts = existsSync(cachedBinary) ? { systemBinary: cachedBinary } : {};
    mongoServer = await MongoMemoryServer.create({ binary: binaryOpts });
    const uri = mongoServer.getUri();
    connection = mongoose.createConnection(uri);
    await connection.asPromise();

    inbox = createTelegramInbox({
      accountManager: mockAccountManager,
      db: { connection },
      options: { autoAttachOnConnect: false },
    });

    // Wait for indexes to build
    await new Promise((r) => setTimeout(r, 500));
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
    vi.clearAllMocks();
    // Restore default mock returns
    mockClient.sendMessage.mockResolvedValue({ id: 123 });
    mockClient.getDialogs.mockResolvedValue([]);
    mockClient.getMessages.mockResolvedValue([]);
    mockAccountManager.getClient.mockReturnValue(mockClient);
  });

  afterAll(async () => {
    if (inbox) await inbox.destroy();
    if (connection) await connection.close();
    if (mongoServer) await mongoServer.stop();
  });

  // ─── 1. Invalid Message Data ──────────────────────────────────────────

  describe('Invalid Message Data', () => {
    it('create message with missing accountId should fail validation', async () => {
      await expect(
        inbox.models.TelegramMessage.create({
          conversationId: 'chat-1',
          messageId: 'neg-1',
          senderId: 'u1',
          senderType: 'user',
          direction: 'inbound',
          contentType: 'text',
          content: 'no account',
        } as any),
      ).rejects.toThrow(/accountId.*required|validation/i);
    });

    it('create message with missing conversationId should fail validation', async () => {
      await expect(
        inbox.models.TelegramMessage.create({
          accountId: 'acc-1',
          messageId: 'neg-2',
          senderId: 'u1',
          senderType: 'user',
          direction: 'inbound',
          contentType: 'text',
          content: 'no convo',
        } as any),
      ).rejects.toThrow(/conversationId.*required|validation/i);
    });

    it('create message with missing messageId should fail validation', async () => {
      await expect(
        inbox.models.TelegramMessage.create({
          accountId: 'acc-1',
          conversationId: 'chat-1',
          senderId: 'u1',
          senderType: 'user',
          direction: 'inbound',
          contentType: 'text',
          content: 'no msgId',
        } as any),
      ).rejects.toThrow(/messageId.*required|validation/i);
    });

    it('create message with duplicate messageId should fail (unique index)', async () => {
      await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'dup-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'original',
      });

      await expect(
        inbox.models.TelegramMessage.create({
          accountId: 'acc-2',
          conversationId: 'chat-2',
          messageId: 'dup-1',
          senderId: 'u2',
          senderType: 'user',
          direction: 'inbound',
          contentType: 'text',
          content: 'duplicate',
        }),
      ).rejects.toThrow(/duplicate|E11000/i);
    });

    it('create message with extremely long content (100KB) should handle', async () => {
      const longContent = 'x'.repeat(100 * 1024);
      const doc = await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'long-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: longContent,
      });

      expect(doc.content).toHaveLength(100 * 1024);
    });

    it('create message with empty content should be allowed (defaults to empty string)', async () => {
      const doc = await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'empty-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
      } as any);

      expect(doc.content).toBe('');
    });
  });

  // ─── 2. Search Attack Vectors ─────────────────────────────────────────

  describe('Search Attack Vectors', () => {
    it('search with empty query should return empty results', async () => {
      await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'srch-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'some content',
      });

      const result = await inbox.conversations.search('');
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('search with whitespace-only query should return empty results', async () => {
      const result = await inbox.conversations.search('   ');
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('search with regex special chars should escape and not crash (ReDoS fix)', async () => {
      await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'rx-neg-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'safe content',
      });

      const dangerousPatterns = [
        '.*+?^${}()|[]\\',
        '(((((((((((((((((((((a+)+)+)+)+)+)+)+)+)+)+)+)+)+)+)+)+)+)+)+)+)',
        '(?=.*)',
        '[\\w]{1,}',
        '\\d{100}',
        '.{0,100000}',
      ];

      for (const pattern of dangerousPatterns) {
        const result = await inbox.conversations.search(pattern);
        expect(result).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
      }
    });

    it('search with extremely long query (10000 chars) should handle', async () => {
      const longQuery = 'a'.repeat(10000);
      const result = await inbox.conversations.search(longQuery);
      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('search with null/undefined should handle gracefully', async () => {
      const r1 = await inbox.conversations.search(null as any);
      expect(r1).toEqual({ items: [], total: 0 });

      const r2 = await inbox.conversations.search(undefined as any);
      expect(r2).toEqual({ items: [], total: 0 });
    });
  });

  // ─── 3. Conversation Edge Cases ───────────────────────────────────────

  describe('Conversation Edge Cases', () => {
    it('list() on empty database should return { items: [], total: 0 }', async () => {
      const result = await inbox.conversations.list();
      expect(result).toEqual({ items: [], total: 0 });
    });

    it('getMessages for non-existent conversationId should return empty', async () => {
      const result = await inbox.conversations.getMessages('non-existent-chat');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('getUnreadCount when all messages are read should return 0', async () => {
      await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'read-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'already read',
        readAt: new Date(),
      });

      const count = await inbox.conversations.getUnreadCount('chat-1');
      expect(count).toBe(0);
    });

    it('markAsRead on non-existent conversation should return 0 (not crash)', async () => {
      const modified = await inbox.conversations.markAsRead('non-existent-chat-999');
      expect(modified).toBe(0);
    });

    it('markAsRead with non-existent upToMessageId should mark all without the date filter', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-mark', messageId: 'mark-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'a' },
        { accountId: 'acc-1', conversationId: 'chat-mark', messageId: 'mark-2', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'b' },
      ]);

      // upToMessageId does not exist, so findOne returns null, no createdAt filter applied, marks all
      const modified = await inbox.conversations.markAsRead('chat-mark', 'non-existent-msg-id');
      expect(modified).toBe(2);

      const unread = await inbox.conversations.getUnreadCount('chat-mark');
      expect(unread).toBe(0);
    });
  });

  // ─── 4. Pagination Edge Cases ─────────────────────────────────────────

  describe('Pagination Edge Cases', () => {
    beforeEach(async () => {
      // Seed 5 messages across 2 conversations
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-p1', messageId: 'pag-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'p1' },
        { accountId: 'acc-1', conversationId: 'chat-p1', messageId: 'pag-2', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'p2' },
        { accountId: 'acc-1', conversationId: 'chat-p1', messageId: 'pag-3', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'p3' },
        { accountId: 'acc-1', conversationId: 'chat-p2', messageId: 'pag-4', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'p4' },
        { accountId: 'acc-1', conversationId: 'chat-p2', messageId: 'pag-5', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'p5' },
      ]);
    });

    it('list() with page=0 should throw (negative skip is invalid)', async () => {
      // page=0 => skip = (0-1)*limit = -50, MongoDB rejects negative $skip
      await expect(inbox.conversations.list(undefined, 0)).rejects.toThrow();
    });

    it('list() with page=-1 should throw (negative skip is invalid)', async () => {
      // page=-1 => skip = (-1-1)*limit = -100, MongoDB rejects negative $skip
      await expect(inbox.conversations.list(undefined, -1)).rejects.toThrow();
    });

    it('list() with limit=0 should throw (MongoDB requires positive limit)', async () => {
      // MongoDB aggregation $limit requires a positive number
      await expect(inbox.conversations.list(undefined, 1, 0)).rejects.toThrow();
    });

    it('list() with limit=999999 should still work (return all)', async () => {
      const result = await inbox.conversations.list(undefined, 1, 999999);
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it('list() with page way beyond total should return empty items', async () => {
      const result = await inbox.conversations.list(undefined, 1000);
      expect(result.total).toBe(2);
      expect(result.items).toEqual([]);
    });

    it('getMessages with page 1000 on 5 messages should return empty', async () => {
      const result = await inbox.conversations.getMessages('chat-p1', 1000);
      expect(result.total).toBe(3);
      expect(result.items).toEqual([]);
    });
  });

  // ─── 5. Multi-Account Conflict Scenarios ──────────────────────────────

  describe('Multi-Account Conflict Scenarios', () => {
    it('two accounts sending same messageId should reject the second (unique index)', async () => {
      await inbox.models.TelegramMessage.create({
        accountId: 'A',
        conversationId: 'shared-chat',
        messageId: 'conflict-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'from A',
      });

      await expect(
        inbox.models.TelegramMessage.create({
          accountId: 'B',
          conversationId: 'shared-chat',
          messageId: 'conflict-1',
          senderId: 'u2',
          senderType: 'user',
          direction: 'inbound',
          contentType: 'text',
          content: 'from B',
        }),
      ).rejects.toThrow(/duplicate|E11000/i);
    });

    it('markAsRead for account A should not affect account B messages', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'A', conversationId: 'shared-chat', messageId: 'iso-a1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'a msg' },
        { accountId: 'B', conversationId: 'shared-chat', messageId: 'iso-b1', senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'b msg' },
      ]);

      await inbox.conversations.markAsRead('shared-chat', undefined, 'A');

      const countA = await inbox.conversations.getUnreadCount('shared-chat', 'A');
      expect(countA).toBe(0);

      const countB = await inbox.conversations.getUnreadCount('shared-chat', 'B');
      expect(countB).toBe(1);
    });

    it('delete all messages for account A should leave account B messages intact', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'A', conversationId: 'shared-chat', messageId: 'del-a1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'a' },
        { accountId: 'A', conversationId: 'shared-chat', messageId: 'del-a2', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'a2' },
        { accountId: 'B', conversationId: 'shared-chat', messageId: 'del-b1', senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'b' },
      ]);

      await inbox.models.TelegramMessage.deleteMany({ accountId: 'A' });

      const remaining = await inbox.models.TelegramMessage.find({});
      expect(remaining).toHaveLength(1);
      expect(remaining[0].accountId).toBe('B');
    });
  });

  // ─── 6. Session Edge Cases ────────────────────────────────────────────

  describe('Session Edge Cases', () => {
    it('close an already-closed session should handle gracefully', async () => {
      const session = await inbox.sessions.create({ accountId: 'acc-1', contactId: 'c1', conversationId: 'chat-1' });
      await inbox.sessions.close(session._id.toString());

      // Close again — should still return the doc with status closed
      const closedAgain = await inbox.sessions.close(session._id.toString());
      expect(closedAgain).not.toBeNull();
      expect(closedAgain!.status).toBe('closed');
    });

    it('pause an already-paused session should handle gracefully', async () => {
      const session = await inbox.sessions.create({ accountId: 'acc-1', contactId: 'c1', conversationId: 'chat-1' });
      await inbox.sessions.pause(session._id.toString());

      const pausedAgain = await inbox.sessions.pause(session._id.toString());
      expect(pausedAgain).not.toBeNull();
      expect(pausedAgain!.status).toBe('paused');
    });

    it('resume a session that is not paused should handle gracefully', async () => {
      const session = await inbox.sessions.create({ accountId: 'acc-1', contactId: 'c1', conversationId: 'chat-1' });

      // Session is active, resuming should still set to active
      const resumed = await inbox.sessions.resume(session._id.toString());
      expect(resumed).not.toBeNull();
      expect(resumed!.status).toBe('active');
    });

    it('getById with invalid ObjectId should throw CastError', async () => {
      // Mongoose throws CastError for invalid ObjectIds in findById
      await expect(inbox.sessions.getById('not-a-valid-object-id')).rejects.toThrow(/Cast to ObjectId failed/);
    });

    it('list sessions with non-matching status filter should return empty', async () => {
      await inbox.sessions.create({ accountId: 'acc-1', contactId: 'c1', conversationId: 'chat-1' });

      const result = await inbox.sessions.list({ status: 'closed' } as any);
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('close a non-existent session should return null', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await inbox.sessions.close(fakeId);
      expect(result).toBeNull();
    });

    it('pause a non-existent session should return null', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await inbox.sessions.pause(fakeId);
      expect(result).toBeNull();
    });
  });

  // ─── 7. SendMessage Edge Cases ────────────────────────────────────────

  describe('SendMessage Edge Cases', () => {
    it('sendMessage with disconnected account (getClient returns null) should throw', async () => {
      mockAccountManager.getClient.mockReturnValueOnce(null);

      await expect(
        inbox.messages.sendMessage('acc-disconnected', 'chat-1', 'test'),
      ).rejects.toThrow('Account acc-disconnected is not connected');
    });

    it('sendMessage with empty text should handle (Telegram may accept it)', async () => {
      await inbox.sessions.create({ accountId: 'acc-1', contactId: 'chat-empty', conversationId: 'chat-empty' });
      mockClient.sendMessage.mockResolvedValueOnce({ id: 999 });

      const saved = await inbox.messages.sendMessage('acc-1', 'chat-empty', '');
      expect(saved.content).toBe('');
      expect(saved.direction).toBe('outbound');
    });

    it('sendMessage when Telegram returns no message ID should throw', async () => {
      mockClient.sendMessage.mockResolvedValueOnce({});

      await expect(
        inbox.messages.sendMessage('acc-1', 'chat-1', 'test'),
      ).rejects.toThrow('Telegram sendMessage returned no message ID');
    });

    it('sendMessage when Telegram returns null should throw', async () => {
      mockClient.sendMessage.mockResolvedValueOnce(null);

      await expect(
        inbox.messages.sendMessage('acc-1', 'chat-1', 'test'),
      ).rejects.toThrow();
    });
  });

  // ─── 8. History Sync Edge Cases ───────────────────────────────────────

  describe('History Sync Edge Cases', () => {
    it('syncChat when already syncing same chat should return error', async () => {
      // Start a sync that takes a while
      mockClient.getMessages.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve([]), 2000)));

      const syncPromise = inbox.history.syncChat('acc-1', 'chat-sync-dup');

      // Second sync immediately should be rejected
      const result2 = await inbox.history.syncChat('acc-1', 'chat-sync-dup');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Sync already in progress');

      // Wait for first sync to complete
      await syncPromise;
    });

    it('syncChat with disconnected account should return error', async () => {
      mockAccountManager.getClient.mockReturnValueOnce(null);

      const result = await inbox.history.syncChat('acc-disconnected', 'chat-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account not connected');
      expect(result.messagesImported).toBe(0);
    });

    it('syncChat with 0 messages from Telegram should return success with 0 imported', async () => {
      mockClient.getMessages.mockResolvedValueOnce([]);

      const result = await inbox.history.syncChat('acc-1', 'chat-empty-sync');
      expect(result.success).toBe(true);
      expect(result.messagesImported).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  // ─── 9. Dialog Sync Edge Cases ────────────────────────────────────────

  describe('Dialog Sync Edge Cases', () => {
    it('syncDialogs with disconnected account should throw', async () => {
      mockAccountManager.getClient.mockReturnValueOnce(null);

      await expect(
        inbox.dialogs.syncDialogs('acc-disconnected'),
      ).rejects.toThrow('Account acc-disconnected is not connected');
    });

    it('syncDialogs returns empty dialog list should return { synced: 0, total: 0 }', async () => {
      mockClient.getDialogs.mockResolvedValueOnce([]);

      const result = await inbox.dialogs.syncDialogs('acc-1');
      expect(result).toEqual({ synced: 0, total: 0 });
    });

    it('loadDialogs with disconnected account should throw', async () => {
      mockAccountManager.getClient.mockReturnValueOnce(null);

      await expect(
        inbox.dialogs.loadDialogs('acc-disconnected'),
      ).rejects.toThrow('Account acc-disconnected is not connected');
    });
  });

  // ─── 10. XSS / Injection in Message Content ──────────────────────────

  describe('XSS / Injection in Message Content', () => {
    it('message content with HTML/script tags should store as-is (sanitization is UI job)', async () => {
      const xssContent = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
      const doc = await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'xss-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: xssContent,
      });

      expect(doc.content).toBe(xssContent);

      const found = await inbox.models.TelegramMessage.findOne({ messageId: 'xss-1' });
      expect(found!.content).toBe(xssContent);
    });

    it('message content with MongoDB operators should store as plain string', async () => {
      const maliciousContent = '{"$gt": ""}';
      const doc = await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'inj-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: maliciousContent,
      });

      expect(doc.content).toBe(maliciousContent);
      expect(typeof doc.content).toBe('string');

      // Verify it is stored as plain text and searching for it works literally
      const found = await inbox.models.TelegramMessage.findOne({ messageId: 'inj-1' });
      expect(found!.content).toBe('{"$gt": ""}');
    });

    it('MongoDB operator in search query should not execute as operator', async () => {
      await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'inj-2',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'normal message',
      });

      // Searching with $gt-like string should be treated as literal text, not operator
      const result = await inbox.conversations.search('{"$gt": ""}');
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    });
  });
});
