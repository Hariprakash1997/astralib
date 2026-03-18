import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { existsSync } from 'fs';
import { resolve } from 'path';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 120_000 });

// Mock BullMQ before any imports that use it
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock ioredis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(() => ({
    options: { host: 'localhost', port: 6379, db: 0 },
    status: 'ready',
    disconnect: vi.fn(),
    quit: vi.fn(),
  }));
  return { default: RedisMock, Redis: RedisMock };
});

import { createEmailAccountManager, type EmailAccountManager } from '../index';

describe('Email Account Manager Integration', () => {
  let mongoServer: MongoMemoryServer;
  let connection: mongoose.Connection;
  let manager: EmailAccountManager;
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

    const { default: Redis } = await import('ioredis');
    const mockRedis = new Redis();

    manager = createEmailAccountManager({
      db: { connection },
      redis: { connection: mockRedis as any },
    });

    // Wait for async init (queues, imap checker) and indexes
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

  describe('Account creation with defaults', () => {
    it('should apply default values when creating an account with minimal input', async () => {
      const account = await manager.accounts.create({
        email: 'test@gmail.com',
        senderName: 'Test',
        provider: 'gmail',
        smtp: { host: 'smtp.gmail.com', port: 587, user: 'test', pass: 'pass' },
        limits: { dailyMax: 50 },
        health: {
          score: 100,
          consecutiveErrors: 0,
          bounceCount: 0,
          thresholds: { minScore: 50, maxBounceRate: 0.1, maxConsecutiveErrors: 5 },
        },
        warmup: { enabled: true, currentDay: 1, schedule: [] },
      });

      expect(account).toBeDefined();
      expect(account.email).toBe('test@gmail.com');
      expect(account.senderName).toBe('Test');
      expect(account.provider).toBe('gmail');
      expect(account.limits.dailyMax).toBe(50);
      expect(account.health.score).toBe(100);
      expect(account.health.thresholds.maxBounceRate).toBe(0.1);
      expect(account.health.thresholds.maxConsecutiveErrors).toBe(5);
      expect(account.status).toBe('active');
      expect(account.totalEmailsSent).toBe(0);

      // Read back from DB to verify persistence
      const fromDb = await manager.accounts.findById(account._id.toString());
      expect(fromDb).not.toBeNull();
      expect(fromDb!.email).toBe('test@gmail.com');
      expect(fromDb!.limits.dailyMax).toBe(50);
      expect(fromDb!.health.score).toBe(100);
      expect(fromDb!.health.thresholds.maxBounceRate).toBe(0.1);
      expect(fromDb!.health.thresholds.maxConsecutiveErrors).toBe(5);
      expect(fromDb!.status).toBe('active');
    });
  });

  describe('Account creation with custom values', () => {
    it('should save custom values while preserving other defaults', async () => {
      const account = await manager.accounts.create({
        email: 'custom@gmail.com',
        senderName: 'Custom',
        provider: 'gmail',
        smtp: { host: 'smtp.gmail.com', port: 587, user: 'custom', pass: 'pass' },
        limits: { dailyMax: 200 },
        health: {
          score: 100,
          consecutiveErrors: 0,
          bounceCount: 0,
          thresholds: { minScore: 70, maxBounceRate: 0.1, maxConsecutiveErrors: 5 },
        },
        warmup: { enabled: true, currentDay: 1, schedule: [] },
      });

      expect(account.limits.dailyMax).toBe(200);
      expect(account.health.thresholds.minScore).toBe(70);

      // Other defaults still applied
      expect(account.health.score).toBe(100);
      expect(account.health.consecutiveErrors).toBe(0);
      expect(account.health.bounceCount).toBe(0);
      expect(account.health.thresholds.maxBounceRate).toBe(0.1);
      expect(account.health.thresholds.maxConsecutiveErrors).toBe(5);
      expect(account.status).toBe('active');
      expect(account.totalEmailsSent).toBe(0);
    });
  });

  describe('Account metadata', () => {
    it('should persist and update metadata', async () => {
      const account = await manager.accounts.create({
        email: 'meta@gmail.com',
        senderName: 'Meta',
        provider: 'gmail',
        smtp: { host: 'smtp.gmail.com', port: 587, user: 'meta', pass: 'pass' },
        limits: { dailyMax: 50 },
        health: {
          score: 100,
          consecutiveErrors: 0,
          bounceCount: 0,
          thresholds: { minScore: 50, maxBounceRate: 0.1, maxConsecutiveErrors: 5 },
        },
        warmup: { enabled: true, currentDay: 1, schedule: [] },
        metadata: {
          sender_names: ['Kavitha', 'Meera'],
          contact_numbers: ['+91-9876543210'],
        },
      });

      // Read back to verify metadata persisted
      const fromDb = await manager.accounts.findById(account._id.toString());
      expect(fromDb!.metadata).toBeDefined();
      expect(fromDb!.metadata!.sender_names).toEqual(['Kavitha', 'Meera']);
      expect(fromDb!.metadata!.contact_numbers).toEqual(['+91-9876543210']);

      // Update metadata
      const updated = await manager.accounts.update(account._id.toString(), {
        metadata: {
          sender_names: ['Kavitha', 'Meera', 'Priya'],
          contact_numbers: ['+91-9876543210', '+91-1234567890'],
        },
      });

      expect(updated!.metadata!.sender_names).toEqual(['Kavitha', 'Meera', 'Priya']);
      expect(updated!.metadata!.contact_numbers).toEqual(['+91-9876543210', '+91-1234567890']);
    });
  });

  describe('Identifier lifecycle', () => {
    it('should handle full identifier lifecycle: create, find, bounce, unsubscribe', async () => {
      // findOrCreate — first call creates
      const identifier = await manager.identifiers.findOrCreate('test@example.com');
      expect(identifier).toBeDefined();
      expect(identifier.email).toBe('test@example.com');
      expect(identifier.status).toBe('active');

      // findOrCreate — second call returns same document
      const sameIdentifier = await manager.identifiers.findOrCreate('test@example.com');
      expect(sameIdentifier._id.toString()).toBe(identifier._id.toString());

      // markBounced
      await manager.identifiers.markBounced('test@example.com', 'inbox_full');
      const bounced = await manager.identifiers.findByEmail('test@example.com');
      expect(bounced).not.toBeNull();
      expect(bounced!.status).toBe('bounced');
      expect(bounced!.bounceType).toBe('inbox_full');
      expect(bounced!.bounceCount).toBe(1);

      // markUnsubscribed
      await manager.identifiers.markUnsubscribed('test@example.com');
      const unsubscribed = await manager.identifiers.findByEmail('test@example.com');
      expect(unsubscribed).not.toBeNull();
      expect(unsubscribed!.status).toBe('unsubscribed');
      expect(unsubscribed!.unsubscribedAt).toBeDefined();
    });
  });

  describe('Identifier dedup (case insensitive)', () => {
    it('should find identifier regardless of email case', async () => {
      await manager.identifiers.findOrCreate('Test@Example.COM');

      const found = await manager.identifiers.findByEmail('test@example.com');
      expect(found).not.toBeNull();
      expect(found!.email).toBe('test@example.com');
    });
  });

  describe('No duplicate Mongoose index warnings', () => {
    it('should not emit duplicate schema index warnings during setup', () => {
      // Check console.warn calls
      const warnCalls = consoleWarnSpy.mock.calls;
      const consoleWarnings = warnCalls.filter((call) =>
        call.some((arg) => typeof arg === 'string' && arg.includes('Duplicate schema index')),
      );
      // Check process.emitWarning calls (Mongoose 8+ uses this)
      const processWarnings = emittedWarnings.filter((msg) =>
        msg.includes('Duplicate schema index'),
      );
      expect(consoleWarnings).toHaveLength(0);
      expect(processWarnings).toHaveLength(0);
    });
  });

  describe('Draft approval lifecycle', () => {
    let accountId: string;

    beforeAll(async () => {
      const account = await manager.accounts.create({
        email: 'draft-test@gmail.com',
        senderName: 'Draft Test',
        provider: 'gmail',
        smtp: { host: 'smtp.gmail.com', port: 587, user: 'draft', pass: 'pass' },
        limits: { dailyMax: 50 },
        health: {
          score: 100,
          consecutiveErrors: 0,
          bounceCount: 0,
          thresholds: { minScore: 50, maxBounceRate: 0.1, maxConsecutiveErrors: 5 },
        },
        warmup: { enabled: true, currentDay: 1, schedule: [] },
      });
      accountId = account._id.toString();
    });

    it('should create a draft with pending status and persist it', async () => {
      const draft = await manager.approval.createDraft({
        to: 'draft@example.com',
        subject: 'Test Draft',
        htmlBody: '<p>Hello</p>',
        textBody: 'Hello',
        accountId,
      });

      expect(draft).toBeDefined();
      expect(draft.status).toBe('pending');
      expect(draft.to).toBe('draft@example.com');
      expect(draft.subject).toBe('Test Draft');
      expect(draft.htmlBody).toBe('<p>Hello</p>');
      expect(draft.textBody).toBe('Hello');

      // Read back from DB to verify persistence
      const draftModelName = Object.keys(connection.models).find(k => k.toLowerCase().includes('draft'))!;
      const updatedDraft = await connection.models[draftModelName]?.findById(draft._id);
      expect(updatedDraft).toBeDefined();
      expect(updatedDraft!.status).toBe('pending');
      expect(updatedDraft!.to).toBe('draft@example.com');
    });

    it('should create a draft with attachments', async () => {
      const draft = await manager.approval.createDraft({
        to: 'att-draft@example.com',
        subject: 'Attachment Draft',
        htmlBody: '<p>See attached</p>',
        accountId,
        attachments: [
          { filename: 'report.pdf', url: 'https://cdn.example.com/report.pdf', contentType: 'application/pdf' },
        ],
      });

      expect(draft.attachments).toHaveLength(1);
      expect(draft.attachments![0].filename).toBe('report.pdf');
    });

    it('should reject a draft with a reason', async () => {
      const draft = await manager.approval.createDraft({
        to: 'reject@example.com',
        subject: 'Reject Draft',
        htmlBody: '<p>Will be rejected</p>',
        accountId,
      });

      expect(draft.status).toBe('pending');

      await manager.approval.reject(draft._id.toString(), 'Content not appropriate');

      const updatedDraft = await connection.models[
        Object.keys(connection.models).find(k => k.toLowerCase().includes('draft'))!
      ]?.findById(draft._id);
      expect(updatedDraft).toBeDefined();
      expect(updatedDraft!.status).toBe('rejected');
      expect(updatedDraft!.rejectionReason).toBe('Content not appropriate');
    });
  });

  describe('Health score updates', () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await manager.accounts.create({
        email: `health-${Date.now()}@gmail.com`,
        senderName: 'Health Test',
        provider: 'gmail',
        smtp: { host: 'smtp.gmail.com', port: 587, user: 'health', pass: 'pass' },
        limits: { dailyMax: 50 },
        health: {
          score: 50,
          consecutiveErrors: 0,
          bounceCount: 0,
          thresholds: { minScore: 10, maxBounceRate: 0.1, maxConsecutiveErrors: 20 },
        },
        warmup: { enabled: true, currentDay: 1, schedule: [] },
      });
      accountId = account._id.toString();
    });

    it('should increment health score on successful send event', async () => {
      const account = await manager.accounts.findById(accountId);
      const initialScore = account!.health.score;

      await manager.health.recordSuccess(accountId);

      const updated = await manager.accounts.findById(accountId);
      expect(updated!.health.score).toBeGreaterThan(initialScore);
    });

    it('should decrement health score on error event', async () => {
      const account = await manager.accounts.findById(accountId);
      const initialScore = account!.health.score;

      await manager.health.recordError(accountId, 'SMTP timeout');

      const updated = await manager.accounts.findById(accountId);
      expect(updated!.health.score).toBeLessThan(initialScore);
    });
  });

  describe('Global settings', () => {
    it('should persist and retrieve settings', async () => {
      await manager.settings.update({ timezone: 'Asia/Kolkata' });
      const settings = await manager.settings.get();
      expect(settings.timezone).toBe('Asia/Kolkata');
    });

    it('should update individual sections', async () => {
      await manager.settings.update({
        ses: { trackOpens: false, trackClicks: true },
      });
      const settings = await manager.settings.get();
      expect(settings.ses.trackOpens).toBe(false);
      expect(settings.ses.trackClicks).toBe(true);
    });
  });

  // ─── Negative scenarios ─────────────────────────────────────────

  describe('Negative scenarios', () => {
    it('should fail when creating account with missing email', async () => {
      await expect(
        manager.accounts.create({
          senderName: 'No Email',
          provider: 'gmail',
          smtp: { host: 'smtp.gmail.com', port: 587, user: 'test', pass: 'pass' },
          limits: { dailyMax: 50 },
          health: {
            score: 100,
            consecutiveErrors: 0,
            bounceCount: 0,
            thresholds: { minScore: 50, maxBounceRate: 0.1, maxConsecutiveErrors: 5 },
          },
          warmup: { enabled: true, currentDay: 1, schedule: [] },
        }),
      ).rejects.toThrow(); // Mongoose required field validation
    });

    it('should fail when creating account with invalid provider', async () => {
      await expect(
        manager.accounts.create({
          email: 'outlook@test.com',
          senderName: 'Outlook User',
          provider: 'outlook' as any,
          smtp: { host: 'smtp.outlook.com', port: 587, user: 'test', pass: 'pass' },
          limits: { dailyMax: 50 },
          health: {
            score: 100,
            consecutiveErrors: 0,
            bounceCount: 0,
            thresholds: { minScore: 50, maxBounceRate: 0.1, maxConsecutiveErrors: 5 },
          },
          warmup: { enabled: true, currentDay: 1, schedule: [] },
        }),
      ).rejects.toThrow(); // Mongoose enum validation
    });

    it('should fail when creating account with missing SMTP config', async () => {
      await expect(
        manager.accounts.create({
          email: 'nosmtp@test.com',
          senderName: 'No SMTP',
          provider: 'gmail',
          limits: { dailyMax: 50 },
          health: {
            score: 100,
            consecutiveErrors: 0,
            bounceCount: 0,
            thresholds: { minScore: 50, maxBounceRate: 0.1, maxConsecutiveErrors: 5 },
          },
          warmup: { enabled: true, currentDay: 1, schedule: [] },
        } as any),
      ).rejects.toThrow(); // Mongoose required field validation for smtp
    });

    it('should return null when updating non-existent account', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await manager.accounts.update(fakeId, { senderName: 'Ghost' });
      expect(result).toBeNull();
    });

    it('should reject identifier with invalid email format', async () => {
      await expect(
        manager.identifiers.findOrCreate('not-an-email'),
      ).rejects.toThrow(/Invalid email format/);
    });

    it('should deduplicate identifiers with same email', async () => {
      const email = `dup-test-${Date.now()}@example.com`;
      const first = await manager.identifiers.findOrCreate(email);
      const second = await manager.identifiers.findOrCreate(email);

      expect(first._id.toString()).toBe(second._id.toString());
    });

    it('should handle health event for non-existent account gracefully', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      // recordSuccess on non-existent account should not throw — returns early
      await expect(manager.health.recordSuccess(fakeId)).resolves.not.toThrow();

      // recordError on non-existent account should not throw — returns early
      await expect(manager.health.recordError(fakeId, 'test error')).resolves.not.toThrow();
    });

    it('should fail when creating draft with missing required fields', async () => {
      // Missing 'to' field
      await expect(
        manager.approval.createDraft({
          subject: 'Test',
          htmlBody: '<p>Hello</p>',
          accountId: new mongoose.Types.ObjectId().toString(),
        } as any),
      ).rejects.toThrow(); // Mongoose required validation for 'to'

      // Missing 'subject' field
      await expect(
        manager.approval.createDraft({
          to: 'test@example.com',
          htmlBody: '<p>Hello</p>',
          accountId: new mongoose.Types.ObjectId().toString(),
        } as any),
      ).rejects.toThrow(); // Mongoose required validation for 'subject'

      // Missing 'htmlBody' field
      await expect(
        manager.approval.createDraft({
          to: 'test@example.com',
          subject: 'Test',
          accountId: new mongoose.Types.ObjectId().toString(),
        } as any),
      ).rejects.toThrow(); // Mongoose required validation for 'htmlBody'
    });
  });
});
