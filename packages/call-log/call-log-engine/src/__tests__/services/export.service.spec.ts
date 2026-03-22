import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportService } from '../../services/export.service.js';
import { CallLogNotFoundError } from '../../errors/index.js';
import type { DateRange } from '@astralibx/call-log-types';

// ── Mock helpers ───────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeCallLogDoc(overrides: Record<string, unknown> = {}) {
  return {
    callLogId: 'call-1',
    pipelineId: 'pipe-1',
    currentStageId: 'stage-1',
    contactRef: { externalId: 'ext-1', displayName: 'Alice Smith', phone: '+1234567890', email: 'alice@example.com' },
    direction: 'inbound',
    callDate: new Date('2026-01-15T10:00:00Z'),
    agentId: 'agent-1',
    priority: 'medium',
    tags: ['vip', 'sales'],
    isClosed: false,
    toObject: function () { return { ...this }; },
    ...overrides,
  };
}

function makeCallLogModel(doc: unknown = null) {
  return {
    findOne: vi.fn().mockResolvedValue(doc),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockResolvedValue(doc ? [doc] : []),
    }),
  };
}

function makeAnalyticsService() {
  return {
    getPipelineStats: vi.fn().mockResolvedValue({
      pipelineId: 'pipe-1',
      pipelineName: 'Test Pipeline',
      totalCalls: 10,
      stages: [
        { stageId: 'stage-1', stageName: 'New', count: 8, avgTimeMs: 3600000, conversionRate: 80 },
        { stageId: 'stage-2', stageName: 'Closed', count: 2, avgTimeMs: 7200000, conversionRate: 20 },
      ],
      bottleneckStage: 'stage-2',
    }),
  };
}

const dateRange: DateRange = { from: '2026-01-01', to: '2026-01-31' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── exportCallLog ──────────────────────────────────────────────────────────

  describe('exportCallLog()', () => {
    it('exports a single call log as JSON', async () => {
      const doc = makeCallLogDoc();
      const CallLog = makeCallLogModel(doc);
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      const result = await service.exportCallLog('call-1', 'json');

      const parsed = JSON.parse(result);
      expect(parsed.callLogId).toBe('call-1');
    });

    it('exports a single call log as CSV with correct headers', async () => {
      const doc = makeCallLogDoc();
      const CallLog = makeCallLogModel(doc);
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      const result = await service.exportCallLog('call-1', 'csv');

      const lines = result.split('\n');
      expect(lines[0]).toBe('callLogId,contactName,contactPhone,contactEmail,direction,pipelineId,currentStageId,priority,agentId,callDate,isClosed,tags');
      expect(lines[1]).toContain('call-1');
    });

    it('throws CallLogNotFoundError if call log not found', async () => {
      const CallLog = makeCallLogModel(null);
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      await expect(service.exportCallLog('no-call', 'json')).rejects.toThrow(CallLogNotFoundError);
    });

    it('CSV escapes values containing commas', async () => {
      const doc = makeCallLogDoc({
        contactRef: { externalId: 'ext-1', displayName: 'Smith, John', phone: '', email: '' },
      });
      const CallLog = makeCallLogModel(doc);
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      const result = await service.exportCallLog('call-1', 'csv');

      expect(result).toContain('"Smith, John"');
    });

    it('CSV escapes values containing double quotes', async () => {
      const doc = makeCallLogDoc({
        contactRef: { externalId: 'ext-1', displayName: 'The "Boss"', phone: '', email: '' },
      });
      const CallLog = makeCallLogModel(doc);
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      const result = await service.exportCallLog('call-1', 'csv');

      expect(result).toContain('"The ""Boss"""');
    });
  });

  // ── exportCallLogs ─────────────────────────────────────────────────────────

  describe('exportCallLogs()', () => {
    it('exports multiple call logs as JSON array', async () => {
      const doc1 = makeCallLogDoc({ callLogId: 'call-1' });
      const doc2 = makeCallLogDoc({ callLogId: 'call-2' });
      const CallLog = makeCallLogModel(null);
      CallLog.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([doc1, doc2]) });
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      const result = await service.exportCallLogs({}, 'json');

      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('exports multiple call logs as CSV', async () => {
      const doc1 = makeCallLogDoc({ callLogId: 'call-1' });
      const doc2 = makeCallLogDoc({ callLogId: 'call-2' });
      const CallLog = makeCallLogModel(null);
      CallLog.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([doc1, doc2]) });
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      const result = await service.exportCallLogs({}, 'csv');

      const lines = result.split('\n');
      expect(lines[0]).toContain('callLogId');
      expect(lines).toHaveLength(3); // header + 2 rows
    });

    it('applies filter for pipelineId', async () => {
      const CallLog = makeCallLogModel(null);
      CallLog.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      await service.exportCallLogs({ pipelineId: 'pipe-1' }, 'json');

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ pipelineId: 'pipe-1' }),
      );
    });

    it('applies filter for tags using $in', async () => {
      const CallLog = makeCallLogModel(null);
      CallLog.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      await service.exportCallLogs({ tags: ['vip', 'urgent'] }, 'json');

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ tags: { $in: ['vip', 'urgent'] } }),
      );
    });

    it('applies dateFrom/dateTo filter on callDate', async () => {
      const CallLog = makeCallLogModel(null);
      CallLog.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      await service.exportCallLogs({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }, 'json');

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({
          callDate: expect.objectContaining({
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ── exportPipelineReport ───────────────────────────────────────────────────

  describe('exportPipelineReport()', () => {
    it('exports pipeline report as JSON', async () => {
      const CallLog = makeCallLogModel();
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      const result = await service.exportPipelineReport('pipe-1', dateRange, 'json');

      const parsed = JSON.parse(result);
      expect(parsed.pipelineId).toBe('pipe-1');
      expect(parsed.stages).toHaveLength(2);
    });

    it('exports pipeline report as CSV with stage rows', async () => {
      const CallLog = makeCallLogModel();
      const analytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, analytics as any, mockLogger);

      const result = await service.exportPipelineReport('pipe-1', dateRange, 'csv');

      const lines = result.split('\n');
      expect(lines[0]).toContain('pipelineId');
      expect(lines[0]).toContain('stageName');
      expect(lines).toHaveLength(3); // header + 2 stage rows
    });

    it('calls pipelineAnalytics.getPipelineStats with pipelineId and dateRange', async () => {
      const CallLog = makeCallLogModel();
      const pipelineAnalytics = makeAnalyticsService();
      const service = new ExportService(CallLog as any, pipelineAnalytics as any, mockLogger);

      await service.exportPipelineReport('pipe-1', dateRange, 'json');

      expect(pipelineAnalytics.getPipelineStats).toHaveBeenCalledWith('pipe-1', dateRange);
    });
  });
});
