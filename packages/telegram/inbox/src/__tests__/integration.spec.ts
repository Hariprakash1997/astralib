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

describe('Telegram Inbox Integration', () => {
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
    // Restore default mock return for getClient
    mockClient.sendMessage.mockResolvedValue({ id: 123 });
    mockAccountManager.getClient.mockReturnValue(mockClient);
  });

  afterAll(async () => {
    if (inbox) await inbox.destroy();
    if (connection) await connection.close();
    if (mongoServer) await mongoServer.stop();
  });

  // ─── 1. Message Storage with accountId ────────────────────────────────

  describe('Message Storage with accountId', () => {
    it('creates a message with accountId via model and persists it', async () => {
      const doc = await inbox.models.TelegramMessage.create({
        accountId: 'acc-1',
        conversationId: 'chat-100',
        messageId: 'msg-1',
        senderId: 'user-1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'hello world',
      });

      expect(doc.accountId).toBe('acc-1');
      expect(doc.conversationId).toBe('chat-100');
      expect(doc.content).toBe('hello world');

      const found = await inbox.models.TelegramMessage.findOne({ messageId: 'msg-1' });
      expect(found).not.toBeNull();
      expect(found!.accountId).toBe('acc-1');
    });

    it('queries messages by accountId returning only matching records', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'msg-a1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'from acc-1' },
        { accountId: 'acc-2', conversationId: 'chat-1', messageId: 'msg-a2', senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'from acc-2' },
      ]);

      const acc1Msgs = await inbox.models.TelegramMessage.find({ accountId: 'acc-1' });
      expect(acc1Msgs).toHaveLength(1);
      expect(acc1Msgs[0].content).toBe('from acc-1');
    });

    it('queries messages without accountId filter returning all records', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'msg-b1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'one' },
        { accountId: 'acc-2', conversationId: 'chat-1', messageId: 'msg-b2', senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'two' },
      ]);

      const all = await inbox.models.TelegramMessage.find({});
      expect(all).toHaveLength(2);
    });
  });

  // ─── 2. Conversation Service ──────────────────────────────────────────

  describe('Conversation Service', () => {
    it('list() returns conversations from multiple chats', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'c1-m1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'hi' },
        { accountId: 'acc-1', conversationId: 'chat-2', messageId: 'c2-m1', senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'hey' },
      ]);

      const result = await inbox.conversations.list();
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      const ids = result.items.map((i) => i.conversationId);
      expect(ids).toContain('chat-1');
      expect(ids).toContain('chat-2');
    });

    it('list() with accountId filter returns only that account conversations', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'f1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'a' },
        { accountId: 'acc-2', conversationId: 'chat-2', messageId: 'f2', senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'b' },
      ]);

      const result = await inbox.conversations.list({ accountId: 'acc-1' });
      expect(result.total).toBe(1);
      expect(result.items[0].conversationId).toBe('chat-1');
    });

    it('getMessages() returns messages sorted by date descending', async () => {
      const now = new Date();
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'gm-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'first', createdAt: new Date(now.getTime() - 2000) },
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'gm-2', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'second', createdAt: new Date(now.getTime() - 1000) },
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'gm-3', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'third', createdAt: now },
      ]);

      const result = await inbox.conversations.getMessages('chat-1');
      expect(result.total).toBe(3);
      expect(result.items[0].content).toBe('third');
      expect(result.items[2].content).toBe('first');
    });

    it('getMessages() with accountId filter returns only that account messages', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'gma-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'acc1 msg' },
        { accountId: 'acc-2', conversationId: 'chat-1', messageId: 'gma-2', senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'acc2 msg' },
      ]);

      const result = await inbox.conversations.getMessages('chat-1', 1, 50, 'acc-1');
      expect(result.total).toBe(1);
      expect(result.items[0].content).toBe('acc1 msg');
    });

    it('getUnreadCount() counts inbound unread messages', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'uc-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'unread1' },
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'uc-2', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'unread2' },
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'uc-3', senderId: 'acc-1', senderType: 'account', direction: 'outbound', contentType: 'text', content: 'sent' },
      ]);

      const count = await inbox.conversations.getUnreadCount();
      expect(count).toBe(2); // only inbound with no readAt
    });

    it('getUnreadCount() with conversationId and accountId filters', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'ucf-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'a' },
        { accountId: 'acc-2', conversationId: 'chat-1', messageId: 'ucf-2', senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'b' },
        { accountId: 'acc-1', conversationId: 'chat-2', messageId: 'ucf-3', senderId: 'u3', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'c' },
      ]);

      const count = await inbox.conversations.getUnreadCount('chat-1', 'acc-1');
      expect(count).toBe(1);
    });

    it('markAsRead() updates readAt on inbound messages', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'mr-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'read me' },
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'mr-2', senderId: 'acc-1', senderType: 'account', direction: 'outbound', contentType: 'text', content: 'sent' },
      ]);

      const modified = await inbox.conversations.markAsRead('chat-1');
      expect(modified).toBe(1); // only inbound gets marked

      const msg = await inbox.models.TelegramMessage.findOne({ messageId: 'mr-1' });
      expect(msg!.readAt).toBeDefined();
      expect(msg!.readAt).toBeInstanceOf(Date);

      const outMsg = await inbox.models.TelegramMessage.findOne({ messageId: 'mr-2' });
      expect(outMsg!.readAt).toBeUndefined();
    });

    it('search() finds matching messages', async () => {
      await inbox.models.TelegramMessage.create([
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'sr-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'hello world' },
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'sr-2', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'goodbye world' },
        { accountId: 'acc-1', conversationId: 'chat-1', messageId: 'sr-3', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'nothing here' },
      ]);

      const result = await inbox.conversations.search('hello');
      expect(result.total).toBe(1);
      expect(result.items[0].content).toBe('hello world');
    });

    it('search() with special regex characters does not crash (ReDoS fix)', async () => {
      await inbox.models.TelegramMessage.create({
        accountId: 'acc-1', conversationId: 'chat-1', messageId: 'rx-1', senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'test (foo) [bar] $100',
      });

      // These should not throw
      const r1 = await inbox.conversations.search('(foo)');
      expect(r1.total).toBe(1);

      const r2 = await inbox.conversations.search('[bar]');
      expect(r2.total).toBe(1);

      const r3 = await inbox.conversations.search('$100');
      expect(r3.total).toBe(1);

      const r4 = await inbox.conversations.search('.*+?^');
      expect(r4.total).toBe(0);
    });
  });

  // ─── 3. Session Service ───────────────────────────────────────────────

  describe('Session Service', () => {
    it('creates a session and persists it', async () => {
      const session = await inbox.sessions.create({
        accountId: 'acc-1',
        contactId: 'contact-1',
        conversationId: 'chat-1',
      });

      expect(session.accountId).toBe('acc-1');
      expect(session.contactId).toBe('contact-1');
      expect(session.status).toBe('active');
      expect(session.messageCount).toBe(0);

      const found = await inbox.sessions.getById(session._id.toString());
      expect(found).not.toBeNull();
      expect(found!.accountId).toBe('acc-1');
    });

    it('lists sessions filtered by accountId', async () => {
      await inbox.sessions.create({ accountId: 'acc-1', contactId: 'c1', conversationId: 'chat-1' });
      await inbox.sessions.create({ accountId: 'acc-2', contactId: 'c2', conversationId: 'chat-2' });

      const result = await inbox.sessions.list({ accountId: 'acc-1' });
      expect(result.total).toBe(1);
      expect(result.items[0].accountId).toBe('acc-1');
    });

    it('closes a session and updates status and endedAt', async () => {
      const session = await inbox.sessions.create({ accountId: 'acc-1', contactId: 'c1', conversationId: 'chat-1' });

      const closed = await inbox.sessions.close(session._id.toString());
      expect(closed).not.toBeNull();
      expect(closed!.status).toBe('closed');
      expect(closed!.endedAt).toBeDefined();
    });

    it('pauses and resumes a session', async () => {
      const session = await inbox.sessions.create({ accountId: 'acc-1', contactId: 'c1', conversationId: 'chat-1' });

      const paused = await inbox.sessions.pause(session._id.toString());
      expect(paused!.status).toBe('paused');

      const resumed = await inbox.sessions.resume(session._id.toString());
      expect(resumed!.status).toBe('active');
      expect(resumed!.endedAt).toBeUndefined();
    });
  });

  // ─── 4. Message Service ───────────────────────────────────────────────

  describe('Message Service', () => {
    it('create() saves a message to DB with all fields including accountId', async () => {
      const msg = await inbox.messages.create({
        accountId: 'acc-1',
        conversationId: 'chat-1',
        messageId: 'ms-1',
        senderId: 'u1',
        senderType: 'user',
        direction: 'inbound',
        contentType: 'text',
        content: 'service created',
      });

      expect(msg.accountId).toBe('acc-1');
      expect(msg.conversationId).toBe('chat-1');
      expect(msg.messageId).toBe('ms-1');
      expect(msg.senderType).toBe('user');
      expect(msg.direction).toBe('inbound');
      expect(msg.content).toBe('service created');

      const found = await inbox.models.TelegramMessage.findOne({ messageId: 'ms-1' });
      expect(found).not.toBeNull();
      expect(found!.accountId).toBe('acc-1');
    });

    it('sendMessage() with mock client saves outbound message with correct fields', async () => {
      // Create an active session so the session update can find it
      await inbox.sessions.create({ accountId: 'acc-1', contactId: 'chat-send', conversationId: 'chat-send' });

      let sendCounter = 200;
      mockClient.sendMessage.mockResolvedValue({ id: sendCounter++ });

      const saved = await inbox.messages.sendMessage('acc-1', 'chat-send', 'outbound text');

      expect(mockAccountManager.getClient).toHaveBeenCalledWith('acc-1');
      expect(mockClient.sendMessage).toHaveBeenCalledWith('chat-send', { message: 'outbound text' });

      expect(saved.accountId).toBe('acc-1');
      expect(saved.conversationId).toBe('chat-send');
      expect(saved.senderType).toBe('account');
      expect(saved.direction).toBe('outbound');
      expect(saved.contentType).toBe('text');
      expect(saved.content).toBe('outbound text');
      expect(saved.senderId).toBe('acc-1');
    });

    it('sendMessage() throws when account is not connected', async () => {
      mockAccountManager.getClient.mockReturnValueOnce(null);

      await expect(
        inbox.messages.sendMessage('acc-disconnected', 'chat-1', 'test'),
      ).rejects.toThrow('Account acc-disconnected is not connected');
    });
  });

  // ─── 5. Dialog Sync ───────────────────────────────────────────────────

  describe('Dialog Sync', () => {
    it('syncDialogs() with mock client creates conversation sessions in DB', async () => {
      mockClient.getDialogs.mockResolvedValueOnce([
        { id: '1001', title: 'Alice', unreadCount: 3, isChannel: false, isGroup: false, message: { message: 'hi', date: Math.floor(Date.now() / 1000) } },
        { id: '1002', title: 'Group Chat', unreadCount: 0, isChannel: false, isGroup: true, message: { message: 'yo', date: Math.floor(Date.now() / 1000) } },
      ]);

      const result = await inbox.dialogs.syncDialogs('acc-1');
      expect(result.synced).toBe(2);
      expect(result.total).toBe(2);

      const sessions = await inbox.models.TelegramConversationSession.find({ accountId: 'acc-1' });
      expect(sessions).toHaveLength(2);

      const aliceSession = sessions.find((s) => s.conversationId === '1001');
      expect(aliceSession).toBeDefined();
      expect(aliceSession!.status).toBe('active');
      expect(aliceSession!.contactId).toBe('1001');
    });

    it('syncDialogs() upserts existing sessions without duplicating', async () => {
      // First sync
      mockClient.getDialogs.mockResolvedValueOnce([
        { id: '2001', title: 'Bob', unreadCount: 1, isChannel: false, isGroup: false, message: { message: 'hey', date: Math.floor(Date.now() / 1000) } },
      ]);
      await inbox.dialogs.syncDialogs('acc-1');

      // Second sync — same dialog
      mockClient.getDialogs.mockResolvedValueOnce([
        { id: '2001', title: 'Bob', unreadCount: 5, isChannel: false, isGroup: false, message: { message: 'hey again', date: Math.floor(Date.now() / 1000) } },
      ]);
      await inbox.dialogs.syncDialogs('acc-1');

      const sessions = await inbox.models.TelegramConversationSession.find({ conversationId: '2001', accountId: 'acc-1' });
      expect(sessions).toHaveLength(1); // no duplicate
    });
  });

  // ─── 6. Multi-Account Isolation ───────────────────────────────────────

  describe('Multi-Account Isolation', () => {
    let seedTimestamp: number;

    beforeEach(async () => {
      // Seed: both accounts send messages in the same chat
      seedTimestamp = Date.now();
      await inbox.models.TelegramMessage.create([
        { accountId: 'A', conversationId: 'shared-chat', messageId: `iso-1-${seedTimestamp}`, senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'msg from A context', createdAt: new Date(seedTimestamp - 3000) },
        { accountId: 'A', conversationId: 'shared-chat', messageId: `iso-2-${seedTimestamp}`, senderId: 'u1', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'another A msg', createdAt: new Date(seedTimestamp - 2000) },
        { accountId: 'B', conversationId: 'shared-chat', messageId: `iso-3-${seedTimestamp}`, senderId: 'u2', senderType: 'user', direction: 'inbound', contentType: 'text', content: 'msg from B context', createdAt: new Date(seedTimestamp - 1000) },
      ]);
    });

    it('list() without filter shows shared-chat once with combined message count', async () => {
      const result = await inbox.conversations.list();
      expect(result.total).toBe(1);
      expect(result.items[0].conversationId).toBe('shared-chat');
      expect(result.items[0].messageCount).toBe(3);
    });

    it('list() with accountId A shows shared-chat with only A message count', async () => {
      const result = await inbox.conversations.list({ accountId: 'A' });
      expect(result.total).toBe(1);
      expect(result.items[0].conversationId).toBe('shared-chat');
      expect(result.items[0].messageCount).toBe(2);
    });

    it('getMessages() with accountId A returns only A messages', async () => {
      const result = await inbox.conversations.getMessages('shared-chat', 1, 50, 'A');
      expect(result.total).toBe(2);
      expect(result.items.every((m) => m.accountId === 'A')).toBe(true);
    });

    it('getMessages() with accountId B returns only B messages', async () => {
      const result = await inbox.conversations.getMessages('shared-chat', 1, 50, 'B');
      expect(result.total).toBe(1);
      expect(result.items[0].accountId).toBe('B');
    });

    it('getUnreadCount() with accountId A returns only A unread count', async () => {
      const countA = await inbox.conversations.getUnreadCount('shared-chat', 'A');
      expect(countA).toBe(2);

      const countB = await inbox.conversations.getUnreadCount('shared-chat', 'B');
      expect(countB).toBe(1);
    });

    it('markAsRead() with accountId only marks that account messages', async () => {
      await inbox.conversations.markAsRead('shared-chat', undefined, 'A');

      const countA = await inbox.conversations.getUnreadCount('shared-chat', 'A');
      expect(countA).toBe(0);

      // B's messages should still be unread
      const countB = await inbox.conversations.getUnreadCount('shared-chat', 'B');
      expect(countB).toBe(1);
    });
  });
});
