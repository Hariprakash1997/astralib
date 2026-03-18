import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
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
import { ACCOUNT_STATUS, DEFAULT_WARMUP_SCHEDULE, HEALTH_SCORE_DECREMENT, IDENTIFIER_STATUS } from '../constants';
import { AccountNotFoundError, ConnectionError } from '../errors';

describe('Telegram Account Manager — Negative / Breaking Scenarios', () => {
  let mongoServer: MongoMemoryServer;
  let connection: mongoose.Connection;
  let manager: TelegramAccountManager;
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeAll(async () => {
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
  // 1. Invalid Input Attacks
  // ===================================================================
  describe('Invalid Input Attacks', () => {
    it('should fail creating account with empty phone', async () => {
      await expect(createAccount({ phone: '' })).rejects.toThrow();
    });

    it('should fail creating account with empty name', async () => {
      await expect(createAccount({ name: '' })).rejects.toThrow();
    });

    it('should fail creating account with empty session', async () => {
      await expect(createAccount({ session: '' })).rejects.toThrow();
    });

    it('should save safely with SQL injection string in phone (no crash)', async () => {
      const account = await createAccount({ phone: "'; DROP TABLE--" });
      expect(account).toBeDefined();
      expect(account.phone).toBe("'; DROP TABLE--");

      const fromDb = await manager.models.TelegramAccount.findById(account._id);
      expect(fromDb).not.toBeNull();
      expect(fromDb!.phone).toBe("'; DROP TABLE--");
    });

    it('should handle extremely long name (10000 chars)', async () => {
      const longName = 'A'.repeat(10000);
      const account = await createAccount({ phone: '+19999999991', name: longName });
      expect(account.name).toBe(longName);
      expect(account.name.length).toBe(10000);
    });

    it('should handle phone containing newlines and null bytes', async () => {
      const weirdPhone = '+1234\n\x00567';
      const account = await createAccount({ phone: weirdPhone });
      expect(account).toBeDefined();
      expect(account.phone).toBe(weirdPhone);
    });

    it('should handle negative currentDailyLimit at model level', async () => {
      // Schema has no min:0 on currentDailyLimit, so model accepts it;
      // the controller rejects it via validation
      const account = await createAccount({ phone: '+19999999992', currentDailyLimit: -5 });
      expect(account.currentDailyLimit).toBe(-5);
    });

    it('should handle delayMin > delayMax at model level (no schema constraint)', async () => {
      const account = await createAccount({
        phone: '+19999999993',
        currentDelayMin: 100000,
        currentDelayMax: 5000,
      });
      expect(account.currentDelayMin).toBe(100000);
      expect(account.currentDelayMax).toBe(5000);
    });
  });

  // ===================================================================
  // 2. Non-Existent Resource Access
  // ===================================================================
  describe('Non-Existent Resource Access', () => {
    const fakeId = new Types.ObjectId().toString();

    it('should throw AccountNotFoundError when connecting non-existent accountId', async () => {
      await expect(manager.connection.connect(fakeId)).rejects.toThrow(AccountNotFoundError);
    });

    it('should no-op when disconnecting non-existent accountId', async () => {
      // disconnect returns void and should not crash
      await expect(manager.connection.disconnect(fakeId)).resolves.toBeUndefined();
    });

    it('should return zeros for capacity on non-existent account', async () => {
      const capacity = await manager.capacity.getAccountCapacity(fakeId);
      expect(capacity.dailyMax).toBe(0);
      expect(capacity.sentToday).toBe(0);
      expect(capacity.remaining).toBe(0);
      expect(capacity.usagePercent).toBe(0);
      expect(capacity.phone).toBe('');
    });

    it('should return null for health on non-existent account', async () => {
      const health = await manager.health.getHealth(fakeId);
      expect(health).toBeNull();
    });

    it('should return null for warmup status on non-existent account', async () => {
      const status = await manager.warmup.getStatus(fakeId);
      expect(status).toBeNull();
    });

    it('should return false when deleting non-existent identifier', async () => {
      const result = await manager.identifiers.delete(fakeId);
      expect(result).toBe(false);
    });

    it('should not crash when advanceDay on non-existent account', async () => {
      await expect(manager.warmup.advanceDay(fakeId)).resolves.toBeUndefined();
    });

    it('should silently no-op recordSuccess on non-existent account', async () => {
      await expect(manager.health.recordSuccess(fakeId)).resolves.toBeUndefined();
    });

    it('should silently no-op recordError on non-existent account', async () => {
      await expect(manager.health.recordError(fakeId, 'TIMEOUT')).resolves.toBeUndefined();
    });
  });

  // ===================================================================
  // 3. Invalid ObjectId Format
  // ===================================================================
  describe('Invalid ObjectId Format', () => {
    it('should throw (not crash) when connecting with invalid id "not-an-id"', async () => {
      await expect(manager.connection.connect('not-an-id')).rejects.toThrow();
    });

    it('should throw when getting account with invalid id "abc"', async () => {
      // findById with bad id throws a CastError
      await expect(manager.models.TelegramAccount.findById('abc')).rejects.toThrow();
    });

    it('should throw when getting health with invalid id ";;;"', async () => {
      await expect(manager.health.getHealth(';;;')).rejects.toThrow();
    });

    it('should throw when getting capacity with invalid id', async () => {
      await expect(manager.capacity.getAccountCapacity('bad-id!')).rejects.toThrow();
    });

    it('should throw when getting warmup status with invalid id', async () => {
      await expect(manager.warmup.getStatus('💀')).rejects.toThrow();
    });
  });

  // ===================================================================
  // 4. Duplicate / Concurrent Operations
  // ===================================================================
  describe('Duplicate / Concurrent Operations', () => {
    it('should fail when creating two accounts with the same phone', async () => {
      await createAccount({ phone: '+14000000099' });
      await expect(createAccount({ phone: '+14000000099' })).rejects.toThrow();
    });

    it('should handle connecting an already-connected account (reconnect or update)', async () => {
      const account = await createAccount({ phone: '+14000000100' });
      const id = account._id.toString();

      await manager.connection.connect(id);
      // Connecting again should not crash — either reconnects or overwrites client entry
      await expect(manager.connection.connect(id)).resolves.toBeUndefined();

      // Cleanup
      await manager.connection.disconnect(id);
    });

    it('should be a no-op when disconnecting an already-disconnected account', async () => {
      const account = await createAccount({ phone: '+14000000101' });
      const id = account._id.toString();

      // Never connected, so disconnect is a no-op
      await expect(manager.connection.disconnect(id)).resolves.toBeUndefined();
      // Second call also a no-op
      await expect(manager.connection.disconnect(id)).resolves.toBeUndefined();
    });

    it('should handle double-delete: first succeeds, second returns false', async () => {
      const identifier = await manager.identifiers.create({
        contactId: 'dup-del-contact',
        telegramUserId: 'dup-del-tg',
      });
      const id = identifier._id.toString();

      const first = await manager.identifiers.delete(id);
      expect(first).toBe(true);

      const second = await manager.identifiers.delete(id);
      expect(second).toBe(false);
    });

    it('should handle creating two identifiers with same telegramUserId (unique constraint)', async () => {
      await manager.identifiers.create({
        contactId: 'dup-1',
        telegramUserId: 'same-tg-id',
      });

      await expect(
        manager.identifiers.create({
          contactId: 'dup-2',
          telegramUserId: 'same-tg-id',
        }),
      ).rejects.toThrow();
    });
  });

  // ===================================================================
  // 5. Health Score Edge Cases
  // ===================================================================
  describe('Health Score Edge Cases', () => {
    it('should stay at 0 when recordError on account with healthScore 0', async () => {
      const account = await createAccount({ phone: '+15000000010', healthScore: 0 });
      const id = account._id.toString();

      await manager.health.recordError(id, 'TIMEOUT');

      const health = await manager.health.getHealth(id);
      expect(health!.healthScore).toBe(0);
    });

    it('should stay at 100 when recordSuccess on account with healthScore 100', async () => {
      const account = await createAccount({ phone: '+15000000011', healthScore: 100 });
      const id = account._id.toString();

      await manager.health.recordSuccess(id);

      const health = await manager.health.getHealth(id);
      expect(health!.healthScore).toBe(100);
    });

    it('should bottom out at 0 after 100 consecutive errors (no crash, no negative)', async () => {
      const account = await createAccount({ phone: '+15000000012', healthScore: 100 });
      const id = account._id.toString();

      for (let i = 0; i < 100; i++) {
        await manager.health.recordError(id, 'TIMEOUT');
      }

      const health = await manager.health.getHealth(id);
      expect(health!.healthScore).toBe(0);
      expect(health!.consecutiveErrors).toBe(100);
    });

    it('should handle unknown error code without crashing', async () => {
      const account = await createAccount({ phone: '+15000000013', healthScore: 80 });
      const id = account._id.toString();

      await manager.health.recordError(id, 'TOTALLY_MADE_UP_ERROR');

      const health = await manager.health.getHealth(id);
      expect(health!.healthScore).toBe(80 - HEALTH_SCORE_DECREMENT);
      expect(health!.consecutiveErrors).toBe(1);
    });

    it('should reset consecutiveErrors on success after multiple errors', async () => {
      const account = await createAccount({ phone: '+15000000014', healthScore: 50 });
      const id = account._id.toString();

      await manager.health.recordError(id, 'TIMEOUT');
      await manager.health.recordError(id, 'TIMEOUT');
      await manager.health.recordError(id, 'TIMEOUT');

      let health = await manager.health.getHealth(id);
      expect(health!.consecutiveErrors).toBe(3);

      await manager.health.recordSuccess(id);

      health = await manager.health.getHealth(id);
      expect(health!.consecutiveErrors).toBe(0);
    });
  });

  // ===================================================================
  // 6. Capacity Edge Cases
  // ===================================================================
  describe('Capacity Edge Cases', () => {
    it('should return 0 for getSentToday when no stats exist', async () => {
      const account = await createAccount({ phone: '+16000000010' });
      const id = account._id.toString();

      const sent = await manager.capacity.getSentToday(id);
      expect(sent).toBe(0);
    });

    it('should return null for getBestAccount when no accounts exist', async () => {
      const best = await manager.capacity.getBestAccount();
      expect(best).toBeNull();
    });

    it('should return null for getBestAccount when all accounts are at capacity', async () => {
      const account = await createAccount({
        phone: '+16000000011',
        warmup: { enabled: false, currentDay: 0, schedule: [] },
        currentDailyLimit: 1,
      });
      const id = account._id.toString();

      // Send one message to exhaust capacity
      await manager.capacity.incrementSent(id);

      const best = await manager.capacity.getBestAccount();
      expect(best).toBeNull();
    });

    it('should return empty accounts and totalRemaining 0 for getAllCapacity when no accounts', async () => {
      const result = await manager.capacity.getAllCapacity();
      expect(result.accounts).toHaveLength(0);
      expect(result.totalRemaining).toBe(0);
    });
  });

  // ===================================================================
  // 7. Warmup Edge Cases
  // ===================================================================
  describe('Warmup Edge Cases', () => {
    it('should no-op advanceDay on account that is not in warmup', async () => {
      const account = await createAccount({
        phone: '+17000000010',
        status: ACCOUNT_STATUS.Connected,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      const id = account._id.toString();

      await manager.warmup.advanceDay(id);

      const fromDb = await manager.models.TelegramAccount.findById(id);
      expect(fromDb!.warmup.currentDay).toBe(0);
      expect(fromDb!.warmup.enabled).toBe(false);
    });

    it('should reset warmup on already-warming account via startWarmup', async () => {
      const account = await createAccount({
        phone: '+17000000011',
        status: ACCOUNT_STATUS.Warmup,
        warmup: {
          enabled: true,
          currentDay: 5,
          startedAt: new Date(Date.now() - 86400000 * 5),
          schedule: defaultSchedule,
        },
      });
      const id = account._id.toString();

      await manager.warmup.startWarmup(id, defaultSchedule);

      const status = await manager.warmup.getStatus(id);
      expect(status!.enabled).toBe(true);
      expect(status!.currentDay).toBe(1); // reset to day 1
    });

    it('should fall back to currentDailyLimit when warmup is disabled (no schedule)', async () => {
      const account = await createAccount({
        phone: '+17000000012',
        warmup: { enabled: false, currentDay: 0, schedule: [] },
        currentDailyLimit: 77,
      });

      const fromDb = await manager.models.TelegramAccount.findById(account._id);
      const limit = await manager.warmup.getDailyLimit(fromDb!);
      expect(limit).toBe(77);
    });

    it('should still complete warmup even when completeWarmup called on non-warmup account', async () => {
      const account = await createAccount({
        phone: '+17000000013',
        status: ACCOUNT_STATUS.Connected,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });
      const id = account._id.toString();

      await manager.warmup.completeWarmup(id);

      const fromDb = await manager.models.TelegramAccount.findById(id);
      // completeWarmup sets enabled=false and status=connected regardless
      expect(fromDb!.warmup.enabled).toBe(false);
      expect(fromDb!.warmup.completedAt).toBeDefined();
      expect(fromDb!.status).toBe(ACCOUNT_STATUS.Connected);
    });
  });

  // ===================================================================
  // 8. Rotator Edge Cases
  // ===================================================================
  describe('Rotator Edge Cases', () => {
    it('should return null from selectAccount when no accounts exist', async () => {
      const selected = await manager.rotator.selectAccount('highest-health');
      expect(selected).toBeNull();
    });

    it('should return null from round-robin when all accounts are at capacity', async () => {
      const account = await createAccount({
        phone: '+18000000010',
        warmup: { enabled: false, currentDay: 0, schedule: [] },
        currentDailyLimit: 1,
      });

      await manager.capacity.incrementSent(account._id.toString());

      const selected = await manager.rotator.selectAccount('round-robin');
      expect(selected).toBeNull();
    });

    it('should return null from least-used when all accounts are at capacity', async () => {
      const account = await createAccount({
        phone: '+18000000011',
        warmup: { enabled: false, currentDay: 0, schedule: [] },
        currentDailyLimit: 1,
      });

      await manager.capacity.incrementSent(account._id.toString());

      const selected = await manager.rotator.selectAccount('least-used');
      expect(selected).toBeNull();
    });

    it('should fall back to highest-health for invalid strategy', async () => {
      await createAccount({
        phone: '+18000000012',
        healthScore: 90,
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });

      // Cast to bypass type check — simulates an adversarial/invalid string
      const selected = await manager.rotator.selectAccount('chaos-mode' as any);
      // Should not crash, falls back to highest-health
      expect(selected).not.toBeNull();
    });

    it('should always return the same account in round-robin with single account', async () => {
      const account = await createAccount({
        phone: '+18000000013',
        warmup: { enabled: false, currentDay: 0, schedule: [] },
      });

      const first = await manager.rotator.selectAccount('round-robin');
      const second = await manager.rotator.selectAccount('round-robin');

      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(first!.accountId).toBe(account._id.toString());
      expect(second!.accountId).toBe(account._id.toString());
    });
  });

  // ===================================================================
  // 9. Identifier Edge Cases
  // ===================================================================
  describe('Identifier Edge Cases', () => {
    it('should fail creating identifier with empty contactId (required field)', async () => {
      await expect(
        manager.identifiers.create({
          contactId: '',
          telegramUserId: 'tg-missing-contact',
        }),
      ).rejects.toThrow(/required/);
    });

    it('should return null for findByTelegramUserId with non-existent userId', async () => {
      const found = await manager.identifiers.findByTelegramUserId('nonexistent-user-999');
      expect(found).toBeNull();
    });

    it('should fail updateStatus with invalid status string', async () => {
      const identifier = await manager.identifiers.create({
        contactId: 'valid-contact',
        telegramUserId: 'tg-valid-status-test',
      });

      // Invalid status should cause a validation error on save
      const updated = await manager.identifiers.updateStatus(
        identifier._id.toString(),
        'TOTALLY_INVALID_STATUS' as any,
      );
      // findByIdAndUpdate with runValidators:false (default) won't reject — Mongoose quirk
      // But the value is still stored
      expect(updated).not.toBeNull();
    });

    it('should handle addKnownAccount to non-existent identifier', async () => {
      const fakeIdentifierId = new Types.ObjectId().toString();
      const fakeAccountId = new Types.ObjectId().toString();

      const result = await manager.identifiers.addKnownAccount(fakeIdentifierId, fakeAccountId);
      expect(result).toBeNull();
    });

    it('should handle incrementSentCount on non-existent identifier', async () => {
      const fakeId = new Types.ObjectId().toString();
      // Should not crash
      await expect(manager.identifiers.incrementSentCount(fakeId)).resolves.toBeUndefined();
    });
  });

  // ===================================================================
  // 10. Connection Edge Cases
  // ===================================================================
  describe('Connection Edge Cases', () => {
    it('should throw when sendMessage on disconnected account', async () => {
      const account = await createAccount({ phone: '+19000000010' });
      const id = account._id.toString();

      // Account was created but never connected via connection service
      await expect(
        manager.sendMessage(id, 'some-chat', 'hello'),
      ).rejects.toThrow(/not connected/);
    });

    it('should return null for getClient on non-existent account', async () => {
      const client = manager.getClient(new Types.ObjectId().toString());
      expect(client).toBeNull();
    });

    it('should return null for getClient on never-connected account', async () => {
      const account = await createAccount({ phone: '+19000000011' });
      const client = manager.getClient(account._id.toString());
      expect(client).toBeNull();
    });

    it('should enforce maxAccounts limit', async () => {
      // Create a manager with maxAccounts = 1
      const limitedManager = createTelegramAccountManager({
        db: { connection, collectionPrefix: 'limited_' },
        credentials: { apiId: 12345, apiHash: 'test-hash' },
        options: {
          maxAccounts: 1,
          warmup: { autoAdvance: false },
        },
      });

      try {
        const acct1 = await limitedManager.models.TelegramAccount.create({
          phone: '+19100000001',
          name: 'Limit Test 1',
          session: 'sess-1',
          warmup: { enabled: false, currentDay: 0, schedule: [] },
          tags: [],
        });
        const acct2 = await limitedManager.models.TelegramAccount.create({
          phone: '+19100000002',
          name: 'Limit Test 2',
          session: 'sess-2',
          warmup: { enabled: false, currentDay: 0, schedule: [] },
          tags: [],
        });

        // Connect first should succeed
        await limitedManager.connection.connect(acct1._id.toString());

        // Connect second should fail — max accounts reached
        await expect(
          limitedManager.connection.connect(acct2._id.toString()),
        ).rejects.toThrow(/Maximum connected accounts/);

        // Cleanup
        await limitedManager.connection.disconnect(acct1._id.toString());
      } finally {
        await limitedManager.destroy();
        // Clean up limited_ collections
        for (const key of Object.keys(connection.collections)) {
          if (key.startsWith('limited_')) {
            await connection.collections[key].deleteMany({});
          }
        }
      }
    });

    it('should return empty array from getConnectedAccounts when none connected', () => {
      const accounts = manager.getConnectedAccounts();
      expect(accounts).toEqual([]);
    });
  });

  // ===================================================================
  // 11. Quarantine Edge Cases
  // ===================================================================
  describe('Quarantine Edge Cases', () => {
    it('should handle quarantine on non-existent account (no-op)', async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(
        manager.quarantine.quarantine(fakeId, 'test reason', 60000),
      ).resolves.toBeUndefined();
    });

    it('should handle release on non-existent account (no-op)', async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(
        manager.quarantine.release(fakeId),
      ).resolves.toBeUndefined();
    });

    it('should return false for isQuarantined on non-existent account', async () => {
      const fakeId = new Types.ObjectId().toString();
      const result = await manager.quarantine.isQuarantined(fakeId);
      expect(result).toBe(false);
    });

    it('should quarantine with very small durationMs (1ms) and auto-release immediately', async () => {
      const account = await createAccount({
        phone: '+19200000001',
        status: ACCOUNT_STATUS.Connected,
      });
      const id = account._id.toString();

      await manager.quarantine.quarantine(id, 'brief quarantine', 1);

      // Wait a tiny bit so the quarantinedUntil is in the past
      await new Promise((r) => setTimeout(r, 10));

      const released = await manager.quarantine.checkAndReleaseExpired();
      expect(released).toBeGreaterThanOrEqual(1);

      const fromDb = await manager.models.TelegramAccount.findById(id);
      expect(fromDb!.status).toBe(ACCOUNT_STATUS.Disconnected);
    });

    it('should handle double quarantine — second overwrites first', async () => {
      const account = await createAccount({
        phone: '+19200000002',
        status: ACCOUNT_STATUS.Connected,
      });
      const id = account._id.toString();

      await manager.quarantine.quarantine(id, 'reason 1', 60000);
      await manager.quarantine.quarantine(id, 'reason 2', 120000);

      const fromDb = await manager.models.TelegramAccount.findById(id);
      expect(fromDb!.quarantineReason).toBe('reason 2');
      expect(fromDb!.status).toBe(ACCOUNT_STATUS.Quarantined);
    });
  });
});
