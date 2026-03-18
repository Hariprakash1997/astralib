import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { existsSync } from 'fs';
import { resolve } from 'path';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 });

// Mock telegram (GramJS) — no real Telegram connection in tests
vi.mock('telegram', () => ({
  TelegramClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getMe: vi.fn().mockResolvedValue({ id: 12345, firstName: 'Test' }),
    sendMessage: vi.fn().mockResolvedValue({ id: 999 }),
    getDialogs: vi.fn().mockResolvedValue([]),
    addEventHandler: vi.fn(),
    removeEventHandler: vi.fn(),
  })),
}));
vi.mock('telegram/sessions', () => ({
  StringSession: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('telegram/tl', () => ({
  Api: { auth: { SendCode: vi.fn(), SignIn: vi.fn(), CheckPassword: vi.fn() }, account: { GetPassword: vi.fn() }, CodeSettings: vi.fn() },
}));

import { createTelegramAccountManager, type TelegramAccountManager } from '../index';
import { ACCOUNT_STATUS, DEFAULT_WARMUP_SCHEDULE, HEALTH_SCORE_INCREMENT, HEALTH_SCORE_DECREMENT } from '../constants';

describe('Telegram Account Manager Integration', () => {
  let mongoServer: MongoMemoryServer;
  let connection: mongoose.Connection;
  let manager: TelegramAccountManager;
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const emittedWarnings: string[] = [];
  const warningListener = (warning: Error) => {
    emittedWarnings.push(warning.message);
  };

  beforeAll(async () => {
    process.on('warning', warningListener);

    // Use the cached mongod binary if available (avoids download on Windows CI)
    const cachedBinary = resolve(__dirname, '../../../../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-8.2.1.exe');
    const binaryOpts = existsSync(cachedBinary) ? { systemBinary: cachedBinary } : {};
    mongoServer = await MongoMemoryServer.create({
      binary: binaryOpts,
    });
    const uri = mongoServer.getUri();
    connection = mongoose.createConnection(uri);
    await connection.asPromise();

    manager = createTelegramAccountManager({
      db: { connection },
      credentials: { apiId: 12345, apiHash: 'test-hash' },
      options: {
        warmup: { autoAdvance: false },
      },
    });

    // Wait for indexes to build
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    const collections = connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    process.removeListener('warning', warningListener);
    consoleWarnSpy.mockRestore();
    if (manager) await manager.destroy();
    if (connection) await connection.close();
    if (mongoServer) await mongoServer.stop();
  });

  // ---------- helpers ----------
  const defaultSchedule = [
    { days: [1, 3] as [number, number], dailyLimit: 10, delayMinMs: 60000, delayMaxMs: 120000 },
    { days: [4, 7] as [number, number], dailyLimit: 25, delayMinMs: 45000, delayMaxMs: 90000 },
  ];

  async function createAccount(overrides: Record<string, unknown> = {}) {
    const defaults = {
      phone: `+1${Date.now()}`,
      name: 'Test Account',
      session: 'test-session-string',
      status: ACCOUNT_STATUS.Connected,
      warmup: {
        enabled: true,
        currentDay: 0,
        schedule: DEFAULT_WARMUP_SCHEDULE,
      },
      tags: [],
    };
    return manager.models.TelegramAccount.create({ ...defaults, ...overrides });
  }

  // ===================================================================
  // 1. Account CRUD
  // ===================================================================
  describe('Account CRUD', () => {
    it('should create account with required fields and verify defaults', async () => {
      const account = await createAccount({ phone: '+10000000001', name: 'Default Test' });

      expect(account).toBeDefined();
      expect(account.phone).toBe('+10000000001');
      expect(account.name).toBe('Default Test');
      expect(account.healthScore).toBe(100);
      expect(account.tags).toEqual([]);
      expect(account.consecutiveErrors).toBe(0);
      expect(account.floodWaitCount).toBe(0);
      expect(account.totalMessagesSent).toBe(0);

      // Read back from DB
      const fromDb = await manager.models.TelegramAccount.findById(account._id);
      expect(fromDb).not.toBeNull();
      expect(fromDb!.phone).toBe('+10000000001');
      expect(fromDb!.healthScore).toBe(100);
    });

    it('should create account with tags and verify tags persisted', async () => {
      const account = await createAccount({
        phone: '+10000000002',
        tags: ['outreach', 'campaign-a'],
      });

      expect(account.tags).toEqual(['outreach', 'campaign-a']);

      const fromDb = await manager.models.TelegramAccount.findById(account._id);
      expect(fromDb!.tags).toEqual(['outreach', 'campaign-a']);
    });

    it('should update account name and tags', async () => {
      const account = await createAccount({ phone: '+10000000003' });

      const updated = await manager.models.TelegramAccount.findByIdAndUpdate(
        account._id,
        { $set: { name: 'Updated Name', tags: ['new-tag'] } },
        { new: true },
      );

      expect(updated!.name).toBe('Updated Name');
      expect(updated!.tags).toEqual(['new-tag']);
    });

    it('should delete account and verify removal', async () => {
      const account = await createAccount({ phone: '+10000000004' });

      await manager.models.TelegramAccount.findByIdAndDelete(account._id);
      const fromDb = await manager.models.TelegramAccount.findById(account._id);
      expect(fromDb).toBeNull();
    });

    it('should fail when creating duplicate phone', async () => {
      await createAccount({ phone: '+10000000005' });

      await expect(createAccount({ phone: '+10000000005' })).rejects.toThrow();
    });
  });

  // ===================================================================
  // 2. Capacity Manager
  // ===================================================================
  describe('Capacity Manager', () => {
    it('should track incrementSent and return getSentToday', async () => {
      const account = await createAccount({ phone: '+12000000001' });
      const id = account._id.toString();

      await manager.capacity.incrementSent(id);

      const sentToday = await manager.capacity.getSentToday(id);
      expect(sentToday).toBe(1);
    });

    it('should track incrementFailed', async () => {
      const account = await createAccount({ phone: '+12000000002' });
      const id = account._id.toString();

      await manager.capacity.incrementFailed(id);

      // Verify via daily stats model
      const today = new Date().toISOString().split('T')[0];
      const stat = await manager.models.TelegramDailyStats.findOne({
        accountId: account._id,
        date: today,
      });
      expect(stat!.failed).toBe(1);
    });

    it('should return best account (highest health with remaining capacity)', async () => {
      const lowHealth = await createAccount({
        phone: '+12000000003',
        healthScore: 50,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      const highHealth = await createAccount({
        phone: '+12000000004',
        healthScore: 100,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });

      const best = await manager.capacity.getBestAccount();
      expect(best).not.toBeNull();
      expect(best!.accountId).toBe(highHealth._id.toString());
    });

    it('should return aggregate capacity via getAllCapacity', async () => {
      await createAccount({
        phone: '+12000000005',
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      await createAccount({
        phone: '+12000000006',
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });

      const result = await manager.capacity.getAllCapacity();
      expect(result.accounts).toHaveLength(2);
      expect(result.totalRemaining).toBeGreaterThan(0);
    });
  });

  // ===================================================================
  // 3. Health Tracker
  // ===================================================================
  describe('Health Tracker', () => {
    it('should increase health score on recordSuccess (clamped at 100)', async () => {
      const account = await createAccount({ phone: '+13000000001', healthScore: 90 });
      const id = account._id.toString();

      await manager.health.recordSuccess(id);

      const health = await manager.health.getHealth(id);
      expect(health!.healthScore).toBe(Math.min(100, 90 + HEALTH_SCORE_INCREMENT));
    });

    it('should decrease health score on recordError', async () => {
      const account = await createAccount({ phone: '+13000000002', healthScore: 80 });
      const id = account._id.toString();

      await manager.health.recordError(id, 'TIMEOUT');

      const health = await manager.health.getHealth(id);
      expect(health!.healthScore).toBe(80 - HEALTH_SCORE_DECREMENT);
      expect(health!.consecutiveErrors).toBe(1);
    });

    it('should clamp health score to 0 (never negative)', async () => {
      const account = await createAccount({ phone: '+13000000003', healthScore: 5 });
      const id = account._id.toString();

      await manager.health.recordError(id, 'TIMEOUT');

      const health = await manager.health.getHealth(id);
      expect(health!.healthScore).toBe(0);
    });

    it('should clamp health score to 100 (never exceed)', async () => {
      const account = await createAccount({ phone: '+13000000004', healthScore: 100 });
      const id = account._id.toString();

      await manager.health.recordSuccess(id);

      const health = await manager.health.getHealth(id);
      expect(health!.healthScore).toBe(100);
    });
  });

  // ===================================================================
  // 4. Warmup Manager
  // ===================================================================
  describe('Warmup Manager', () => {
    it('should start warmup — status changes to warmup, day 1', async () => {
      const account = await createAccount({
        phone: '+14000000001',
        status: ACCOUNT_STATUS.Disconnected,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      const id = account._id.toString();

      await manager.warmup.startWarmup(id, defaultSchedule);

      const status = await manager.warmup.getStatus(id);
      expect(status!.enabled).toBe(true);
      expect(status!.currentDay).toBe(1);
      expect(status!.startedAt).toBeDefined();

      const fromDb = await manager.models.TelegramAccount.findById(id);
      expect(fromDb!.status).toBe(ACCOUNT_STATUS.Warmup);
    });

    it('should advance day on advanceDay', async () => {
      const account = await createAccount({
        phone: '+14000000002',
        status: ACCOUNT_STATUS.Warmup,
        warmup: { enabled: true, currentDay: 1, startedAt: new Date(), schedule: defaultSchedule },
      });
      const id = account._id.toString();

      await manager.warmup.advanceDay(id);

      const status = await manager.warmup.getStatus(id);
      expect(status!.currentDay).toBe(2);
    });

    it('should complete warmup when advancing past max day', async () => {
      const account = await createAccount({
        phone: '+14000000003',
        status: ACCOUNT_STATUS.Warmup,
        warmup: {
          enabled: true,
          currentDay: 7, // max day in our schedule is 7
          startedAt: new Date(),
          schedule: defaultSchedule,
        },
      });
      const id = account._id.toString();

      await manager.warmup.advanceDay(id);

      const fromDb = await manager.models.TelegramAccount.findById(id);
      expect(fromDb!.status).toBe(ACCOUNT_STATUS.Connected);
      expect(fromDb!.warmup.enabled).toBe(false);
      expect(fromDb!.warmup.completedAt).toBeDefined();
    });

    it('should return phase-appropriate daily limit via getDailyLimit', async () => {
      const account = await createAccount({
        phone: '+14000000004',
        status: ACCOUNT_STATUS.Warmup,
        warmup: { enabled: true, currentDay: 2, startedAt: new Date(), schedule: defaultSchedule },
      });

      const fromDb = await manager.models.TelegramAccount.findById(account._id);
      const limit = await manager.warmup.getDailyLimit(fromDb!);
      // Day 2 is in phase [1,3] which has dailyLimit 10
      expect(limit).toBe(10);
    });
  });

  // ===================================================================
  // 5. Account Rotator
  // ===================================================================
  describe('Account Rotator', () => {
    it('should select highest-health account with capacity', async () => {
      await createAccount({
        phone: '+15000000001',
        healthScore: 60,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      await createAccount({
        phone: '+15000000002',
        healthScore: 90,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      await createAccount({
        phone: '+15000000003',
        healthScore: 75,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });

      const selected = await manager.rotator.selectAccount('highest-health');
      expect(selected).not.toBeNull();
      expect(selected!.phone).toBe('+15000000002');
    });

    it('should cycle through accounts with round-robin', async () => {
      await createAccount({
        phone: '+15000000004',
        healthScore: 80,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      await createAccount({
        phone: '+15000000005',
        healthScore: 80,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });

      const first = await manager.rotator.selectAccount('round-robin');
      const second = await manager.rotator.selectAccount('round-robin');

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      // Round-robin should pick different accounts on consecutive calls
      expect(first!.accountId).not.toBe(second!.accountId);
    });

    it('should select least-used account', async () => {
      const a1 = await createAccount({
        phone: '+15000000006',
        healthScore: 80,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      await createAccount({
        phone: '+15000000007',
        healthScore: 80,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });

      // Send some messages on a1 to increase usage
      await manager.capacity.incrementSent(a1._id.toString());
      await manager.capacity.incrementSent(a1._id.toString());

      const selected = await manager.rotator.selectAccount('least-used');
      expect(selected).not.toBeNull();
      expect(selected!.phone).toBe('+15000000007');
    });
  });

  // ===================================================================
  // 6. Identifier Service
  // ===================================================================
  describe('Identifier Service', () => {
    it('should create identifier and persist', async () => {
      const identifier = await manager.identifiers.create({
        contactId: 'contact-001',
        telegramUserId: 'tg-user-001',
        firstName: 'John',
        username: 'johndoe',
      });

      expect(identifier).toBeDefined();
      expect(identifier.contactId).toBe('contact-001');
      expect(identifier.telegramUserId).toBe('tg-user-001');
      expect(identifier.status).toBe('active');
      expect(identifier.sentCount).toBe(0);
    });

    it('should find identifier by telegramUserId', async () => {
      await manager.identifiers.create({
        contactId: 'contact-002',
        telegramUserId: 'tg-user-002',
      });

      const found = await manager.identifiers.findByTelegramUserId('tg-user-002');
      expect(found).not.toBeNull();
      expect(found!.telegramUserId).toBe('tg-user-002');
    });

    it('should update status', async () => {
      const identifier = await manager.identifiers.create({
        contactId: 'contact-003',
        telegramUserId: 'tg-user-003',
      });

      const updated = await manager.identifiers.updateStatus(
        identifier._id.toString(),
        'blocked',
      );

      expect(updated!.status).toBe('blocked');
    });

    it('should add known account to identifier', async () => {
      const account = await createAccount({ phone: '+16000000001' });
      const identifier = await manager.identifiers.create({
        contactId: 'contact-004',
        telegramUserId: 'tg-user-004',
      });

      const updated = await manager.identifiers.addKnownAccount(
        identifier._id.toString(),
        account._id.toString(),
      );

      expect(updated!.knownByAccounts).toHaveLength(1);
      expect(updated!.knownByAccounts[0].toString()).toBe(account._id.toString());
    });

    it('should increment sent count', async () => {
      const identifier = await manager.identifiers.create({
        contactId: 'contact-005',
        telegramUserId: 'tg-user-005',
      });

      await manager.identifiers.incrementSentCount(identifier._id.toString());
      await manager.identifiers.incrementSentCount(identifier._id.toString());

      const fromDb = await manager.identifiers.findById(identifier._id.toString());
      expect(fromDb!.sentCount).toBe(2);
      expect(fromDb!.lastActiveAt).toBeDefined();
    });
  });

  // ===================================================================
  // 7. Tags
  // ===================================================================
  describe('Tags', () => {
    it('should create account with tags and retrieve them', async () => {
      const account = await createAccount({
        phone: '+17000000001',
        tags: ['vip', 'outreach'],
      });

      const fromDb = await manager.models.TelegramAccount.findById(account._id);
      expect(fromDb!.tags).toEqual(['vip', 'outreach']);
    });

    it('should filter accounts by tag', async () => {
      await createAccount({ phone: '+17000000002', tags: ['alpha'] });
      await createAccount({ phone: '+17000000003', tags: ['beta'] });
      await createAccount({ phone: '+17000000004', tags: ['alpha', 'beta'] });

      const alphaAccounts = await manager.models.TelegramAccount.find({ tags: 'alpha' });
      expect(alphaAccounts).toHaveLength(2);

      const betaAccounts = await manager.models.TelegramAccount.find({ tags: 'beta' });
      expect(betaAccounts).toHaveLength(2);
    });

    it('should update tags on an existing account', async () => {
      const account = await createAccount({
        phone: '+17000000005',
        tags: ['old-tag'],
      });

      await manager.models.TelegramAccount.findByIdAndUpdate(
        account._id,
        { $set: { tags: ['new-tag-1', 'new-tag-2'] } },
      );

      const fromDb = await manager.models.TelegramAccount.findById(account._id);
      expect(fromDb!.tags).toEqual(['new-tag-1', 'new-tag-2']);
    });
  });

  // ===================================================================
  // 8. Daily Stats
  // ===================================================================
  describe('Daily Stats', () => {
    it('should create/update daily record on incrementStat', async () => {
      const account = await createAccount({ phone: '+18000000001' });
      const id = account._id.toString();
      const today = new Date().toISOString().split('T')[0];

      await manager.models.TelegramDailyStats.incrementStat(id, 'sent');

      const stat = await manager.models.TelegramDailyStats.findOne({
        accountId: account._id,
        date: today,
      });
      expect(stat).not.toBeNull();
      expect(stat!.sent).toBe(1);
    });

    it('should accumulate multiple increments on the same day', async () => {
      const account = await createAccount({ phone: '+18000000002' });
      const id = account._id.toString();
      const today = new Date().toISOString().split('T')[0];

      await manager.models.TelegramDailyStats.incrementStat(id, 'sent');
      await manager.models.TelegramDailyStats.incrementStat(id, 'sent');
      await manager.models.TelegramDailyStats.incrementStat(id, 'sent');

      const stat = await manager.models.TelegramDailyStats.findOne({
        accountId: account._id,
        date: today,
      });
      expect(stat!.sent).toBe(3);
    });

    it('should create separate records for different days', async () => {
      const account = await createAccount({ phone: '+18000000003' });
      const id = account._id.toString();

      await manager.models.TelegramDailyStats.incrementStat(id, 'sent', 5, '2025-01-01');
      await manager.models.TelegramDailyStats.incrementStat(id, 'sent', 3, '2025-01-02');

      const day1 = await manager.models.TelegramDailyStats.findOne({
        accountId: account._id,
        date: '2025-01-01',
      });
      const day2 = await manager.models.TelegramDailyStats.findOne({
        accountId: account._id,
        date: '2025-01-02',
      });

      expect(day1!.sent).toBe(5);
      expect(day2!.sent).toBe(3);
    });
  });

  // ===================================================================
  // Mongoose index warnings
  // ===================================================================
  describe('No duplicate Mongoose index warnings', () => {
    it('should not emit duplicate schema index warnings during setup', () => {
      // Note: phone (unique:true + schema.index) and telegramUserId (unique:true + schema.index)
      // produce expected warnings — filter those known duplicates out
      const knownDuplicates = ['phone', 'telegramUserId'];

      const processWarnings = emittedWarnings.filter((msg) => {
        if (!msg.includes('Duplicate schema index')) return false;
        return !knownDuplicates.some((field) => msg.includes(`{"${field}":1}`));
      });
      expect(processWarnings).toHaveLength(0);
    });
  });
});
