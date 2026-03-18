import mongoose from 'mongoose';
import { createEmailAnalytics, EVENT_TYPE } from '../index';
import type { EmailAnalytics } from '../index';
import type { CreateEventInput } from '../types/event.types';

describe('Email Analytics Integration', () => {
  let connection: mongoose.Connection;
  let analytics: EmailAnalytics;

  const accountId1 = new mongoose.Types.ObjectId().toString();
  const accountId2 = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    const uri = process.env['MONGOMS_TEST_URI'];
    if (!uri) {
      throw new Error('MONGOMS_TEST_URI not set. globalSetup may have failed.');
    }
    connection = mongoose.createConnection(uri);
    await connection.asPromise();

    analytics = createEmailAnalytics({
      db: {
        connection,
        collectionPrefix: 'test_',
      },
      options: {
        timezone: 'UTC',
      },
    });
  }, 30_000);

  afterAll(async () => {
    if (connection) {
      await connection.close();
    }
  }, 30_000);

  afterEach(async () => {
    await analytics.models.EmailEvent.deleteMany({});
    await analytics.models.AnalyticsStats.deleteMany({});
  });

  function makeEvent(overrides: Partial<CreateEventInput> = {}): CreateEventInput {
    return {
      type: EVENT_TYPE.Sent,
      accountId: accountId1,
      recipientEmail: 'test@example.com',
      ...overrides,
    };
  }

  describe('Event recording', () => {
    it('should record a sent event and persist it in DB', async () => {
      await analytics.events.record(makeEvent({ type: EVENT_TYPE.Sent }));

      const docs = await analytics.models.EmailEvent.find({});
      expect(docs).toHaveLength(1);
      expect(docs[0].type).toBe('sent');
      expect(docs[0].recipientEmail).toBe('test@example.com');
    });

    it('should record a bounced event and persist it in DB', async () => {
      await analytics.events.record(makeEvent({ type: EVENT_TYPE.Bounced }));

      const docs = await analytics.models.EmailEvent.find({});
      expect(docs).toHaveLength(1);
      expect(docs[0].type).toBe('bounced');
    });

    it('should batch record 5 events and persist all in DB', async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        makeEvent({ recipientEmail: `user${i}@example.com` }),
      );

      await analytics.events.recordBatch(events);

      const docs = await analytics.models.EmailEvent.find({});
      expect(docs).toHaveLength(5);
    });
  });

  describe('Aggregation', () => {
    it('should aggregate daily stats with correct counts', async () => {
      const today = new Date();

      // Record 10 sent events and 2 bounced events
      const sentEvents = Array.from({ length: 10 }, () =>
        makeEvent({ type: EVENT_TYPE.Sent, timestamp: today }),
      );
      const bouncedEvents = Array.from({ length: 2 }, () =>
        makeEvent({ type: EVENT_TYPE.Bounced, timestamp: today }),
      );
      await analytics.events.recordBatch([...sentEvents, ...bouncedEvents]);

      await analytics.aggregator.aggregateDaily(today);

      const statsDocs = await analytics.models.AnalyticsStats.find({
        accountId: null,
        ruleId: null,
        templateId: null,
      });
      expect(statsDocs.length).toBeGreaterThanOrEqual(1);

      const overall = statsDocs[0];
      expect(overall.sent).toBe(10);
      expect(overall.bounced).toBe(2);
    });
  });

  describe('Query overview', () => {
    it('should return correct overview stats after aggregation', async () => {
      const today = new Date();

      const sentEvents = Array.from({ length: 10 }, () =>
        makeEvent({ type: EVENT_TYPE.Sent, timestamp: today }),
      );
      const bouncedEvents = Array.from({ length: 2 }, () =>
        makeEvent({ type: EVENT_TYPE.Bounced, timestamp: today }),
      );
      await analytics.events.recordBatch([...sentEvents, ...bouncedEvents]);
      await analytics.aggregator.aggregateDaily(today);

      const overview = await analytics.query.getOverview(today, today);

      expect(overview.sent).toBe(10);
      expect(overview.bounced).toBe(2);
      expect(overview.failed).toBe(0);
      expect(overview.delivered).toBe(0);
    });
  });

  describe('Query per-account stats', () => {
    it('should return per-account breakdown after aggregation', async () => {
      const today = new Date();

      // 5 sent for account1, 3 sent for account2
      const account1Events = Array.from({ length: 5 }, () =>
        makeEvent({ type: EVENT_TYPE.Sent, accountId: accountId1, timestamp: today }),
      );
      const account2Events = Array.from({ length: 3 }, () =>
        makeEvent({ type: EVENT_TYPE.Sent, accountId: accountId2, timestamp: today }),
      );
      await analytics.events.recordBatch([...account1Events, ...account2Events]);
      await analytics.aggregator.aggregateDaily(today);

      const accountStats = await analytics.query.getAccountStats(today, today);

      expect(accountStats).toHaveLength(2);

      const acc1 = accountStats.find((a) => a.accountId === accountId1);
      const acc2 = accountStats.find((a) => a.accountId === accountId2);

      expect(acc1).toBeDefined();
      expect(acc1!.sent).toBe(5);

      expect(acc2).toBeDefined();
      expect(acc2!.sent).toBe(3);
    });
  });

  describe('Date range filtering', () => {
    it('should return only matching days when queried with a specific date range', async () => {
      const day1 = new Date('2025-06-01T12:00:00Z');
      const day2 = new Date('2025-06-02T12:00:00Z');
      const day3 = new Date('2025-06-03T12:00:00Z');

      await analytics.events.recordBatch([
        makeEvent({ type: EVENT_TYPE.Sent, timestamp: day1 }),
        makeEvent({ type: EVENT_TYPE.Sent, timestamp: day2 }),
        makeEvent({ type: EVENT_TYPE.Sent, timestamp: day3 }),
      ]);

      await analytics.aggregator.aggregateRange(day1, day3);

      // Query only day1-day2 range
      const overview = await analytics.query.getOverview(day1, day2);
      expect(overview.sent).toBe(2);

      // Query full range
      const fullOverview = await analytics.query.getOverview(day1, day3);
      expect(fullOverview.sent).toBe(3);

      // Timeline should show individual days
      const timeline = await analytics.query.getTimeline(day1, day3);
      expect(timeline).toHaveLength(3);
      timeline.forEach((entry) => {
        expect(entry.sent).toBe(1);
      });
    });
  });

  describe('Empty results', () => {
    it('should return zeros for a date range with no events', async () => {
      const from = new Date('2020-01-01T00:00:00Z');
      const to = new Date('2020-01-31T23:59:59Z');

      const overview = await analytics.query.getOverview(from, to);

      expect(overview.sent).toBe(0);
      expect(overview.bounced).toBe(0);
      expect(overview.failed).toBe(0);
      expect(overview.delivered).toBe(0);
      expect(overview.complained).toBe(0);
      expect(overview.opened).toBe(0);
      expect(overview.clicked).toBe(0);
      expect(overview.unsubscribed).toBe(0);
    });
  });

  describe('Channel tracking', () => {
    it('should record events with channel and persist them', async () => {
      await analytics.events.record(
        makeEvent({
          type: EVENT_TYPE.Sent,
          recipientEmail: 'chan1@example.com',
          channel: 'whatsapp',
        }),
      );

      await analytics.events.record(
        makeEvent({
          type: EVENT_TYPE.Sent,
          recipientEmail: 'chan2@example.com',
          channel: 'email',
        }),
      );

      const docs = await analytics.models.EmailEvent.find({});
      expect(docs).toHaveLength(2);

      const channels = docs.map((d) => d.channel).sort();
      expect(channels).toContain('email');
      expect(channels).toContain('whatsapp');
    });

    it('should aggregate channel events into daily stats', async () => {
      const today = new Date();

      await analytics.events.recordBatch([
        makeEvent({ type: EVENT_TYPE.Sent, recipientEmail: 'ch1@example.com', channel: 'whatsapp', timestamp: today }),
        makeEvent({ type: EVENT_TYPE.Sent, recipientEmail: 'ch2@example.com', channel: 'email', timestamp: today }),
        makeEvent({ type: EVENT_TYPE.Sent, recipientEmail: 'ch3@example.com', channel: 'email', timestamp: today }),
      ]);

      await analytics.aggregator.aggregateDaily(today);

      const overview = await analytics.query.getOverview(today, today);
      expect(overview.sent).toBe(3);
    });
  });

  describe('Variant analytics', () => {
    it('should track subject/body variant indices on events', async () => {
      const today = new Date();

      await analytics.events.record(
        makeEvent({
          type: EVENT_TYPE.Sent,
          recipientEmail: 'var1@example.com',
          subjectIndex: 0,
          bodyIndex: 0,
          timestamp: today,
        }),
      );

      await analytics.events.record(
        makeEvent({
          type: EVENT_TYPE.Sent,
          recipientEmail: 'var2@example.com',
          subjectIndex: 1,
          bodyIndex: 0,
          timestamp: today,
        }),
      );

      await analytics.events.record(
        makeEvent({
          type: EVENT_TYPE.Sent,
          recipientEmail: 'var3@example.com',
          subjectIndex: 0,
          bodyIndex: 1,
          timestamp: today,
        }),
      );

      const docs = await analytics.models.EmailEvent.find({}).sort({ recipientEmail: 1 });
      expect(docs).toHaveLength(3);

      const var1 = docs.find((d) => d.recipientEmail === 'var1@example.com');
      expect(var1!.subjectIndex).toBe(0);
      expect(var1!.bodyIndex).toBe(0);

      const var2 = docs.find((d) => d.recipientEmail === 'var2@example.com');
      expect(var2!.subjectIndex).toBe(1);
      expect(var2!.bodyIndex).toBe(0);

      const var3 = docs.find((d) => d.recipientEmail === 'var3@example.com');
      expect(var3!.subjectIndex).toBe(0);
      expect(var3!.bodyIndex).toBe(1);

      // Aggregate and verify variant stats were created
      await analytics.aggregator.aggregateDaily(today);

      // Verify variant stats differentiate between subject indices
      const variantStats = await analytics.models.AnalyticsStats.find({
        subjectIndex: { $ne: null },
      });
      expect(variantStats.length).toBeGreaterThanOrEqual(2);

      const subj0 = variantStats.filter((s) => s.subjectIndex === 0);
      const subj1 = variantStats.filter((s) => s.subjectIndex === 1);
      expect(subj0.length).toBeGreaterThanOrEqual(1);
      expect(subj1.length).toBeGreaterThanOrEqual(1);

      // Subject 0 has 2 sent (var1 + var3), Subject 1 has 1 sent (var2)
      const subj0Total = subj0.reduce((sum, s) => sum + (s as any).sent, 0);
      const subj1Total = subj1.reduce((sum, s) => sum + (s as any).sent, 0);
      expect(subj0Total).toBe(2);
      expect(subj1Total).toBe(1);
    });
  });

  describe('Batch recording edge cases', () => {
    it('should handle empty batch gracefully', async () => {
      await expect(analytics.events.recordBatch([])).resolves.not.toThrow();

      const docs = await analytics.models.EmailEvent.find({});
      expect(docs).toHaveLength(0);
    });

    it('should handle large batch of events', async () => {
      const events = Array.from({ length: 100 }, (_, i) =>
        makeEvent({ recipientEmail: `batch${i}@example.com` }),
      );

      await analytics.events.recordBatch(events);

      const docs = await analytics.models.EmailEvent.find({});
      expect(docs).toHaveLength(100);
    });
  });

  // ─── Negative scenarios ─────────────────────────────────────────

  describe('Negative scenarios', () => {
    it('should fail when recording event with missing required type', async () => {
      await expect(
        analytics.events.record({
          accountId: accountId1,
          recipientEmail: 'test@example.com',
        } as any),
      ).rejects.toThrow(); // Mongoose required validation for 'type'
    });

    it('should reject event with missing accountId', async () => {
      await expect(
        analytics.events.record({
          type: EVENT_TYPE.Sent,
          recipientEmail: 'test@example.com',
        } as any),
      ).rejects.toThrow(/accountId is required/);
    });

    it('should fail when recording event with invalid event type', async () => {
      await expect(
        analytics.events.record(
          makeEvent({ type: 'invalid_event' as any }),
        ),
      ).rejects.toThrow(); // Mongoose enum validation
    });

    it('should throw InvalidDateRangeError when aggregating with from after to', async () => {
      const from = new Date('2025-06-10T00:00:00Z');
      const to = new Date('2025-06-01T00:00:00Z');

      await expect(
        analytics.aggregator.aggregateRange(from, to),
      ).rejects.toThrow(); // InvalidDateRangeError
    });

    it('should return zeros when querying overview with no events (missing date params scenario)', async () => {
      const from = new Date('2099-01-01T00:00:00Z');
      const to = new Date('2099-12-31T23:59:59Z');

      const overview = await analytics.query.getOverview(from, to);

      expect(overview.sent).toBe(0);
      expect(overview.bounced).toBe(0);
      expect(overview.failed).toBe(0);
      expect(overview.delivered).toBe(0);
    });

    it('should complete aggregation without error when no events exist', async () => {
      const today = new Date();

      // aggregateDaily with no events should not throw
      await expect(
        analytics.aggregator.aggregateDaily(today),
      ).resolves.not.toThrow();

      // Stats should be empty or zero
      const overview = await analytics.query.getOverview(today, today);
      expect(overview.sent).toBe(0);
    });

    it('should reject event with extremely long recipientEmail field', async () => {
      const longEmail = 'a'.repeat(10000) + '@example.com';

      await expect(
        analytics.events.record(
          makeEvent({ recipientEmail: longEmail }),
        ),
      ).rejects.toThrow(/maximum allowed length/);
    });
  });
});
