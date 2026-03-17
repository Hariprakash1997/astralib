import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventRecorderService } from '../services/event-recorder';
import type { CreateEventInput } from '../types/event.types';

function createMockModel() {
  const chainable = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  };

  return {
    create: vi.fn().mockResolvedValue({}),
    record: vi.fn().mockResolvedValue({}),
    insertMany: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockReturnValue(chainable),
    countDocuments: vi.fn().mockResolvedValue(0),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    _chainable: chainable,
  };
}

function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('EventRecorderService', () => {
  let service: EventRecorderService;
  let mockModel: ReturnType<typeof createMockModel>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockModel = createMockModel();
    mockLogger = createMockLogger();
    service = new EventRecorderService(mockModel as any, mockLogger);
  });

  describe('record()', () => {
    it('should call schema record static with event data', async () => {
      const event: CreateEventInput = {
        type: 'sent',
        accountId: 'acc123',
        recipientEmail: 'test@example.com',
      };

      await service.record(event);

      expect(mockModel.record).toHaveBeenCalledOnce();
      expect(mockModel.record).toHaveBeenCalledWith(event);
    });

    it('should pass through timestamp to schema static', async () => {
      const ts = new Date('2024-06-15T10:00:00Z');
      const event: CreateEventInput = {
        type: 'delivered',
        accountId: 'acc123',
        recipientEmail: 'test@example.com',
        timestamp: ts,
      };

      await service.record(event);

      const arg = mockModel.record.mock.calls[0][0];
      expect(arg.timestamp).toBe(ts);
    });

    it('should log after recording', async () => {
      const event: CreateEventInput = {
        type: 'clicked',
        accountId: 'acc456',
        recipientEmail: 'test@example.com',
      };

      await service.record(event);

      expect(mockLogger.info).toHaveBeenCalledWith('Event recorded', {
        type: 'clicked',
        accountId: 'acc456',
      });
    });
  });

  describe('recordBatch()', () => {
    it('should call model.insertMany with events', async () => {
      const events: CreateEventInput[] = [
        { type: 'sent', accountId: 'acc1', recipientEmail: 'a@b.com' },
        { type: 'delivered', accountId: 'acc1', recipientEmail: 'a@b.com' },
      ];

      await service.recordBatch(events);

      expect(mockModel.insertMany).toHaveBeenCalledOnce();
      const [docs, opts] = mockModel.insertMany.mock.calls[0];
      expect(docs).toHaveLength(2);
      expect(opts).toEqual({ ordered: false });
    });

    it('should not call insertMany for empty array', async () => {
      await service.recordBatch([]);
      expect(mockModel.insertMany).not.toHaveBeenCalled();
    });

    it('should assign timestamps to events without one', async () => {
      const events: CreateEventInput[] = [
        { type: 'sent', accountId: 'acc1', recipientEmail: 'a@b.com' },
      ];

      await service.recordBatch(events);

      const docs = mockModel.insertMany.mock.calls[0][0];
      expect(docs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should log batch count', async () => {
      const events: CreateEventInput[] = [
        { type: 'sent', accountId: 'acc1', recipientEmail: 'a@b.com' },
        { type: 'sent', accountId: 'acc2', recipientEmail: 'b@b.com' },
        { type: 'sent', accountId: 'acc3', recipientEmail: 'c@b.com' },
      ];

      await service.recordBatch(events);

      expect(mockLogger.info).toHaveBeenCalledWith('Batch events recorded', { count: 3 });
    });
  });

  describe('getEvents()', () => {
    it('should build query with date range filters', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      await service.getEvents({ dateFrom, dateTo });

      expect(mockModel.find).toHaveBeenCalledOnce();
      const query = mockModel.find.mock.calls[0][0];
      expect(query.timestamp.$gte).toBe(dateFrom);
      expect(query.timestamp.$lte).toBe(dateTo);
    });

    it('should add optional filters when provided', async () => {
      const filters = {
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        type: 'sent',
        accountId: 'acc123',
        ruleId: 'rule1',
        recipientEmail: 'test@example.com',
      };

      await service.getEvents(filters);

      const query = mockModel.find.mock.calls[0][0];
      expect(query.type).toBe('sent');
      expect(query.accountId).toBe('acc123');
      expect(query.ruleId).toBe('rule1');
      expect(query.recipientEmail).toBe('test@example.com');
    });

    it('should not add undefined optional filters', async () => {
      const filters = {
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
      };

      await service.getEvents(filters);

      const query = mockModel.find.mock.calls[0][0];
      expect(query.type).toBeUndefined();
      expect(query.accountId).toBeUndefined();
    });

    it('should use default pagination (page=1, limit=50)', async () => {
      await service.getEvents({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
      });

      expect(mockModel._chainable.skip).toHaveBeenCalledWith(0);
      expect(mockModel._chainable.limit).toHaveBeenCalledWith(50);
    });

    it('should calculate skip correctly for page 3 with limit 20', async () => {
      await service.getEvents(
        { dateFrom: new Date('2024-01-01'), dateTo: new Date('2024-01-31') },
        3,
        20,
      );

      expect(mockModel._chainable.skip).toHaveBeenCalledWith(40);
      expect(mockModel._chainable.limit).toHaveBeenCalledWith(20);
    });

    it('should sort by timestamp descending', async () => {
      await service.getEvents({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
      });

      expect(mockModel._chainable.sort).toHaveBeenCalledWith({ timestamp: -1 });
    });

    it('should return events and total count', async () => {
      const mockEvents = [{ type: 'sent' }, { type: 'delivered' }];
      mockModel._chainable.lean.mockResolvedValue(mockEvents);
      mockModel.countDocuments.mockResolvedValue(42);

      const result = await service.getEvents({
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
      });

      expect(result.events).toBe(mockEvents);
      expect(result.total).toBe(42);
    });

    it('should call countDocuments with same query as find', async () => {
      const filters = {
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        type: 'bounced',
      };

      await service.getEvents(filters);

      const findQuery = mockModel.find.mock.calls[0][0];
      const countQuery = mockModel.countDocuments.mock.calls[0][0];
      expect(countQuery).toEqual(findQuery);
    });
  });

  describe('purgeOldEvents()', () => {
    it('should call deleteMany with date cutoff', async () => {
      await service.purgeOldEvents(30);

      expect(mockModel.deleteMany).toHaveBeenCalledOnce();
      const query = mockModel.deleteMany.mock.calls[0][0];
      expect(query.timestamp.$lt).toBeInstanceOf(Date);
    });

    it('should calculate cutoff date correctly', async () => {
      const before = new Date();
      before.setDate(before.getDate() - 30);

      await service.purgeOldEvents(30);

      const cutoff = mockModel.deleteMany.mock.calls[0][0].timestamp.$lt;
      const diff = Math.abs(cutoff.getTime() - before.getTime());
      expect(diff).toBeLessThan(1000);
    });

    it('should return deleted count', async () => {
      mockModel.deleteMany.mockResolvedValue({ deletedCount: 150 });

      const count = await service.purgeOldEvents(60);

      expect(count).toBe(150);
    });

    it('should return 0 when deletedCount is missing', async () => {
      mockModel.deleteMany.mockResolvedValue({});

      const count = await service.purgeOldEvents(60);

      expect(count).toBe(0);
    });

    it('should log purge result', async () => {
      mockModel.deleteMany.mockResolvedValue({ deletedCount: 5 });

      await service.purgeOldEvents(90);

      expect(mockLogger.info).toHaveBeenCalledWith('Purged old events', {
        olderThanDays: 90,
        deleted: 5,
      });
    });
  });
});
