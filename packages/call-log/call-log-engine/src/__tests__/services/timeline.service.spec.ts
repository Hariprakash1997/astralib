import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimelineService } from '../../services/timeline.service.js';
import { CallLogNotFoundError, CallLogClosedError } from '../../errors/index.js';
import { TimelineEntryType } from '@astralibx/call-log-types';
import type { ITimelineEntry } from '@astralibx/call-log-types';
import type { ResolvedOptions } from '@astralibx/call-log-types';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const defaultOptions: ResolvedOptions = {
  maxTimelineEntries: 5,
  followUpCheckIntervalMs: 60_000,
};

function makeTimelineEntry(overrides: Partial<ITimelineEntry> = {}): ITimelineEntry {
  return {
    entryId: 'entry-1',
    type: TimelineEntryType.Note,
    content: 'A note',
    authorId: 'user-1',
    authorName: 'Alice',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

function makeCallLogDoc(overrides: Record<string, unknown> = {}) {
  return {
    callLogId: 'call-1',
    isClosed: false,
    timeline: [] as ITimelineEntry[],
    ...overrides,
  };
}

function makeCallLogModel(doc: unknown = null) {
  return {
    findOne: vi.fn().mockResolvedValue(doc),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    aggregate: vi.fn().mockResolvedValue([]),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TimelineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── addNote ───────────────────────────────────────────────────────────────

  describe('addNote()', () => {
    it('creates a note entry with correct fields', async () => {
      const callLogDoc = makeCallLogDoc();
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const entry = await service.addNote('call-1', 'Test note', 'user-1', 'Alice');

      expect(entry.type).toBe(TimelineEntryType.Note);
      expect(entry.content).toBe('Test note');
      expect(entry.authorId).toBe('user-1');
      expect(entry.authorName).toBe('Alice');
      expect(entry.entryId).toMatch(/^[0-9a-f-]{36}$/);
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('calls $push with $slice to cap at maxTimelineEntries', async () => {
      const callLogDoc = makeCallLogDoc();
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, { ...defaultOptions, maxTimelineEntries: 5 });

      await service.addNote('call-1', 'Note', 'user-1', 'Alice');

      expect(CallLog.updateOne).toHaveBeenCalledWith(
        { callLogId: 'call-1' },
        {
          $push: {
            timeline: {
              $each: [expect.objectContaining({ type: TimelineEntryType.Note })],
              $slice: -5,
            },
          },
        },
      );
    });

    it('throws CallLogNotFoundError when call log does not exist', async () => {
      const CallLog = makeCallLogModel(null);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      await expect(service.addNote('no-call', 'Note', 'u1', 'Alice')).rejects.toThrow(CallLogNotFoundError);
    });

    it('throws CallLogClosedError when call log is closed', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(closedDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      await expect(service.addNote('call-1', 'Note', 'u1', 'Alice')).rejects.toThrow(CallLogClosedError);
    });

    it('logs the note addition', async () => {
      const callLogDoc = makeCallLogDoc();
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      await service.addNote('call-1', 'Note', 'user-1', 'Alice');

      expect(mockLogger.info).toHaveBeenCalledWith('Note added to call log', {
        callLogId: 'call-1',
        entryId: expect.any(String),
      });
    });
  });

  // ── addSystemEntry ────────────────────────────────────────────────────────

  describe('addSystemEntry()', () => {
    it('creates a system entry with correct type', async () => {
      const callLogDoc = makeCallLogDoc();
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const entry = await service.addSystemEntry('call-1', 'Call log created');

      expect(entry.type).toBe(TimelineEntryType.System);
      expect(entry.content).toBe('Call log created');
      expect(entry.entryId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('works on closed call logs (no isClosed check)', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(closedDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const entry = await service.addSystemEntry('call-1', 'System note on closed call');

      expect(entry.type).toBe(TimelineEntryType.System);
    });

    it('throws CallLogNotFoundError when call log does not exist', async () => {
      const CallLog = makeCallLogModel(null);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      await expect(service.addSystemEntry('no-call', 'Sys')).rejects.toThrow(CallLogNotFoundError);
    });

    it('uses $push with $slice to cap entries', async () => {
      const callLogDoc = makeCallLogDoc();
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, { ...defaultOptions, maxTimelineEntries: 10 });

      await service.addSystemEntry('call-1', 'System');

      expect(CallLog.updateOne).toHaveBeenCalledWith(
        { callLogId: 'call-1' },
        {
          $push: {
            timeline: {
              $each: [expect.objectContaining({ type: TimelineEntryType.System })],
              $slice: -10,
            },
          },
        },
      );
    });
  });

  // ── getTimeline ───────────────────────────────────────────────────────────

  describe('getTimeline()', () => {
    it('returns all entries for page 1', async () => {
      const entries = [
        makeTimelineEntry({ entryId: 'e1', createdAt: new Date('2026-01-01T09:00:00Z') }),
        makeTimelineEntry({ entryId: 'e2', createdAt: new Date('2026-01-01T10:00:00Z') }),
        makeTimelineEntry({ entryId: 'e3', createdAt: new Date('2026-01-01T11:00:00Z') }),
      ];
      const callLogDoc = makeCallLogDoc({ timeline: entries });
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const result = await service.getTimeline('call-1', { page: 1, limit: 10 });

      expect(result.total).toBe(3);
      expect(result.entries).toHaveLength(3);
    });

    it('paginates timeline entries', async () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        makeTimelineEntry({ entryId: `e${i}`, createdAt: new Date(2026, 0, i + 1) }),
      );
      const callLogDoc = makeCallLogDoc({ timeline: entries });
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const result = await service.getTimeline('call-1', { page: 1, limit: 2 });

      expect(result.total).toBe(5);
      expect(result.entries).toHaveLength(2);
    });

    it('returns empty entries for out-of-range page', async () => {
      const entries = [makeTimelineEntry({ entryId: 'e1' })];
      const callLogDoc = makeCallLogDoc({ timeline: entries });
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const result = await service.getTimeline('call-1', { page: 10, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.entries).toHaveLength(0);
    });

    it('throws CallLogNotFoundError when call log does not exist', async () => {
      const CallLog = makeCallLogModel(null);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      await expect(service.getTimeline('no-call', { page: 1, limit: 10 })).rejects.toThrow(CallLogNotFoundError);
    });

    it('returns entries in reverse chronological order', async () => {
      const entries = [
        makeTimelineEntry({ entryId: 'e1', createdAt: new Date('2026-01-01T08:00:00Z') }),
        makeTimelineEntry({ entryId: 'e2', createdAt: new Date('2026-01-01T09:00:00Z') }),
        makeTimelineEntry({ entryId: 'e3', createdAt: new Date('2026-01-01T10:00:00Z') }),
      ];
      const callLogDoc = makeCallLogDoc({ timeline: entries });
      const CallLog = makeCallLogModel(callLogDoc);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const result = await service.getTimeline('call-1', { page: 1, limit: 10 });

      // Newest first
      expect(result.entries[0].entryId).toBe('e3');
      expect(result.entries[2].entryId).toBe('e1');
    });
  });

  // ── getContactTimeline ────────────────────────────────────────────────────

  describe('getContactTimeline()', () => {
    it('returns entries from aggregate and total from count', async () => {
      const entry = { ...makeTimelineEntry(), callLogId: 'call-1' };
      const CallLog = makeCallLogModel();
      // First aggregate call returns count, second returns entries
      CallLog.aggregate
        .mockResolvedValueOnce([{ total: 2 }])
        .mockResolvedValueOnce([entry]);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const result = await service.getContactTimeline('contact-ext-1', { page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].callLogId).toBe('call-1');
    });

    it('returns 0 total when no call logs match', async () => {
      const CallLog = makeCallLogModel();
      CallLog.aggregate
        .mockResolvedValueOnce([])  // count result — no match
        .mockResolvedValueOnce([]); // entries result
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      const result = await service.getContactTimeline('unknown-ext', { page: 1, limit: 10 });

      expect(result.total).toBe(0);
      expect(result.entries).toHaveLength(0);
    });

    it('passes correct skip/limit to aggregate pipeline', async () => {
      const CallLog = makeCallLogModel();
      CallLog.aggregate.mockResolvedValue([]);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      await service.getContactTimeline('ext-id', { page: 2, limit: 5 });

      // The second aggregate call (entries) should have $skip: 5, $limit: 5
      const secondAggCall = CallLog.aggregate.mock.calls[1][0];
      const skipStage = secondAggCall.find((s: Record<string, unknown>) => '$skip' in s);
      const limitStage = secondAggCall.find((s: Record<string, unknown>) => '$limit' in s);
      expect(skipStage).toEqual({ $skip: 5 });
      expect(limitStage).toEqual({ $limit: 5 });
    });

    it('matches on contactRef.externalId in aggregate', async () => {
      const CallLog = makeCallLogModel();
      CallLog.aggregate.mockResolvedValue([]);
      const service = new TimelineService(CallLog as any, mockLogger, defaultOptions);

      await service.getContactTimeline('my-ext-id', { page: 1, limit: 10 });

      const firstAggCall = CallLog.aggregate.mock.calls[0][0];
      const matchStage = firstAggCall.find((s: Record<string, unknown>) => '$match' in s);
      expect(matchStage).toEqual({ $match: { 'contactRef.externalId': 'my-ext-id' } });
    });
  });
});
