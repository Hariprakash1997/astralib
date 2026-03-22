import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallLogService } from '../../services/call-log.service.js';
import {
  CallLogNotFoundError,
  CallLogClosedError,
  PipelineNotFoundError,
} from '../../errors/index.js';
import { TimelineEntryType, CallDirection, CallPriority } from '@astralibx/call-log-types';
import type { ITimelineEntry, ResolvedOptions } from '@astralibx/call-log-types';

// ── Mock helpers ───────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const defaultOptions: ResolvedOptions = {
  maxTimelineEntries: 200,
  followUpCheckIntervalMs: 60_000,
};

const mockHooks = {
  onCallCreated: vi.fn(),
  onStageChanged: vi.fn(),
  onCallClosed: vi.fn(),
  onCallAssigned: vi.fn(),
};

const mockTimeline = {
  addNote: vi.fn(),
  addSystemEntry: vi.fn(),
  getTimeline: vi.fn(),
  getContactTimeline: vi.fn(),
};

function makeStage(overrides: Record<string, unknown> = {}) {
  return {
    stageId: 'stage-1',
    name: 'New',
    color: '#000',
    order: 1,
    isDefault: true,
    isTerminal: false,
    ...overrides,
  };
}

function makePipeline(overrides: Record<string, unknown> = {}) {
  return {
    pipelineId: 'pipe-1',
    name: 'Test Pipeline',
    stages: [
      makeStage({ stageId: 'stage-1', name: 'New', isDefault: true, isTerminal: false }),
      makeStage({ stageId: 'stage-2', name: 'Closed', isDefault: false, isTerminal: true }),
    ],
    isDeleted: false,
    ...overrides,
  };
}

function makeCallLogDoc(overrides: Record<string, unknown> = {}) {
  return {
    callLogId: 'call-1',
    pipelineId: 'pipe-1',
    currentStageId: 'stage-1',
    contactRef: { externalId: 'ext-1', displayName: 'Alice', phone: '1234' },
    direction: CallDirection.Inbound,
    callDate: new Date('2026-01-01T10:00:00Z'),
    agentId: 'agent-1',
    priority: CallPriority.Medium,
    tags: [],
    timeline: [] as ITimelineEntry[],
    stageHistory: [],
    isClosed: false,
    createdAt: new Date('2026-01-01T09:00:00Z'),
    ...overrides,
  };
}

function makeCallLogModel(doc: unknown = null) {
  return {
    findOne: vi.fn().mockResolvedValue(doc),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((data: Record<string, unknown>) => Promise.resolve({ ...data, agentId: data.agentId })),
    findOneAndUpdate: vi.fn().mockResolvedValue(doc),
    countDocuments: vi.fn().mockResolvedValue(0),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
}

function makePipelineModel(doc: unknown = null) {
  return {
    findOne: vi.fn().mockResolvedValue(doc),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CallLogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('generates callLogId and sets default stage', async () => {
      const pipeline = makePipeline();
      const CallLog = makeCallLogModel();
      const Pipeline = makePipelineModel(pipeline);
      CallLog.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve({ ...data }),
      );
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.create({
        pipelineId: 'pipe-1',
        contactRef: { externalId: 'ext-1', displayName: 'Alice' },
        direction: CallDirection.Inbound,
        callDate: new Date(),
        agentId: 'agent-1',
      });

      expect(result.callLogId).toBeDefined();
      expect(result.currentStageId).toBe('stage-1');
    });

    it('fires onCallCreated hook', async () => {
      const pipeline = makePipeline();
      const CallLog = makeCallLogModel();
      const Pipeline = makePipelineModel(pipeline);
      CallLog.create.mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve({ ...data }),
      );
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.create({
        pipelineId: 'pipe-1',
        contactRef: { externalId: 'ext-1', displayName: 'Alice' },
        direction: CallDirection.Inbound,
        callDate: new Date(),
        agentId: 'agent-1',
      });

      expect(mockHooks.onCallCreated).toHaveBeenCalledTimes(1);
    });

    it('adds Call Created system timeline entry', async () => {
      const pipeline = makePipeline();
      const CallLog = makeCallLogModel();
      const Pipeline = makePipelineModel(pipeline);
      let createdData: Record<string, unknown> = {};
      CallLog.create.mockImplementation((data: Record<string, unknown>) => {
        createdData = data;
        return Promise.resolve({ ...data });
      });
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.create({
        pipelineId: 'pipe-1',
        contactRef: { externalId: 'ext-1', displayName: 'Alice' },
        direction: CallDirection.Inbound,
        callDate: new Date(),
        agentId: 'agent-1',
      });

      const timeline = createdData.timeline as ITimelineEntry[];
      expect(timeline).toHaveLength(1);
      expect(timeline[0].type).toBe(TimelineEntryType.System);
      expect(typeof timeline[0].content).toBe('string');
    });

    it('throws PipelineNotFoundError if pipeline not found', async () => {
      const CallLog = makeCallLogModel();
      const Pipeline = makePipelineModel(null);
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(
        service.create({
          pipelineId: 'no-pipe',
          contactRef: { externalId: 'ext-1', displayName: 'Alice' },
          direction: CallDirection.Inbound,
          callDate: new Date(),
          agentId: 'agent-1',
        }),
      ).rejects.toThrow(PipelineNotFoundError);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('modifies allowed fields and returns updated doc', async () => {
      const callLogDoc = makeCallLogDoc();
      const updatedDoc = makeCallLogDoc({ priority: CallPriority.High });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.update('call-1', { priority: CallPriority.High });

      expect(result.priority).toBe(CallPriority.High);
    });

    it('throws CallLogClosedError if call log is closed', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(closedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.update('call-1', { priority: CallPriority.High })).rejects.toThrow(CallLogClosedError);
    });

    it('throws CallLogNotFoundError if call log not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.update('no-call', {})).rejects.toThrow(CallLogNotFoundError);
    });

    it('adds FollowUpSet timeline entry when nextFollowUpDate changes', async () => {
      const callLogDoc = makeCallLogDoc({ nextFollowUpDate: undefined });
      const updatedDoc = makeCallLogDoc({ nextFollowUpDate: new Date('2026-02-01') });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.update('call-1', { nextFollowUpDate: new Date('2026-02-01') });

      expect(CallLog.findOneAndUpdate).toHaveBeenCalledWith(
        { callLogId: 'call-1' },
        expect.objectContaining({
          $push: expect.objectContaining({
            timeline: expect.objectContaining({
              $each: expect.arrayContaining([
                expect.objectContaining({ type: TimelineEntryType.FollowUpSet }),
              ]),
            }),
          }),
        }),
        { new: true },
      );
    });
  });

  // ── changeStage ────────────────────────────────────────────────────────────

  describe('changeStage()', () => {
    it('updates currentStageId, adds stageHistory and timeline entry', async () => {
      const callLogDoc = makeCallLogDoc({ stageHistory: [] });
      const updatedDoc = makeCallLogDoc({ currentStageId: 'stage-2', isClosed: true });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.changeStage('call-1', 'stage-2', 'agent-1');

      expect(CallLog.findOneAndUpdate).toHaveBeenCalledWith(
        { callLogId: 'call-1', currentStageId: 'stage-1' },
        expect.objectContaining({
          $push: expect.objectContaining({
            stageHistory: expect.any(Object),
            timeline: expect.objectContaining({ type: TimelineEntryType.StageChange }),
          }),
        }),
        { new: true },
      );
      expect(result.currentStageId).toBe('stage-2');
    });

    it('sets isClosed when moving to terminal stage', async () => {
      const callLogDoc = makeCallLogDoc();
      const updatedDoc = makeCallLogDoc({ currentStageId: 'stage-2', isClosed: true, closedAt: new Date() });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.changeStage('call-1', 'stage-2', 'agent-1');

      expect(result.isClosed).toBe(true);
    });

    it('fires onCallClosed when moving to terminal stage', async () => {
      const callLogDoc = makeCallLogDoc();
      const updatedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.changeStage('call-1', 'stage-2', 'agent-1');

      expect(mockHooks.onCallClosed).toHaveBeenCalledTimes(1);
    });

    it('fires onStageChanged hook', async () => {
      const callLogDoc = makeCallLogDoc();
      const updatedDoc = makeCallLogDoc({ currentStageId: 'stage-2' });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.changeStage('call-1', 'stage-2', 'agent-1');

      expect(mockHooks.onStageChanged).toHaveBeenCalledTimes(1);
    });

    it('throws error if concurrent modification detected (null result)', async () => {
      const callLogDoc = makeCallLogDoc();
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(null);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.changeStage('call-1', 'stage-2', 'agent-1')).rejects.toThrow(CallLogClosedError);
    });

    it('throws CallLogClosedError if call log is already closed', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(closedDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.changeStage('call-1', 'stage-2', 'agent-1')).rejects.toThrow(CallLogClosedError);
    });
  });

  // ── assign ─────────────────────────────────────────────────────────────────

  describe('assign()', () => {
    it('changes agent and adds Assignment timeline entry', async () => {
      const callLogDoc = makeCallLogDoc({ agentId: 'old-agent' });
      const updatedDoc = makeCallLogDoc({ agentId: 'new-agent' });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.assign('call-1', 'new-agent', 'admin-1');

      expect(result.agentId).toBe('new-agent');
      expect(CallLog.findOneAndUpdate).toHaveBeenCalledWith(
        { callLogId: 'call-1' },
        expect.objectContaining({
          $push: expect.objectContaining({
            timeline: expect.objectContaining({
              $each: expect.arrayContaining([
                expect.objectContaining({ type: TimelineEntryType.Assignment }),
              ]),
            }),
          }),
        }),
        { new: true },
      );
    });

    it('fires onCallAssigned hook', async () => {
      const callLogDoc = makeCallLogDoc({ agentId: 'old-agent' });
      const updatedDoc = makeCallLogDoc({ agentId: 'new-agent' });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.assign('call-1', 'new-agent', 'admin-1');

      expect(mockHooks.onCallAssigned).toHaveBeenCalledTimes(1);
    });

    it('throws CallLogNotFoundError if call log not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.assign('no-call', 'agent-2', 'admin-1')).rejects.toThrow(CallLogNotFoundError);
    });
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('returns paginated call logs with total', async () => {
      const docs = [makeCallLogDoc(), makeCallLogDoc({ callLogId: 'call-2' })];
      const CallLog = makeCallLogModel();
      const sortMock = { skip: vi.fn().mockReturnThis() };
      const skipMock = { limit: vi.fn().mockResolvedValue(docs) };
      sortMock.skip.mockReturnValue(skipMock);
      CallLog.find.mockReturnValue({ sort: vi.fn().mockReturnValue(sortMock) });
      CallLog.countDocuments.mockResolvedValue(2);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.list({ page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('filters by pipelineId, agentId, isClosed', async () => {
      const CallLog = makeCallLogModel();
      const sortMock = { skip: vi.fn().mockReturnThis() };
      const skipMock = { limit: vi.fn().mockResolvedValue([]) };
      sortMock.skip.mockReturnValue(skipMock);
      CallLog.find.mockReturnValue({ sort: vi.fn().mockReturnValue(sortMock) });
      CallLog.countDocuments.mockResolvedValue(0);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.list({ pipelineId: 'pipe-1', agentId: 'agent-1', isClosed: false });

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({
          pipelineId: 'pipe-1',
          agentId: 'agent-1',
          isClosed: false,
        }),
      );
    });

    it('filters by tags using $in', async () => {
      const CallLog = makeCallLogModel();
      const sortMock = { skip: vi.fn().mockReturnThis() };
      const skipMock = { limit: vi.fn().mockResolvedValue([]) };
      sortMock.skip.mockReturnValue(skipMock);
      CallLog.find.mockReturnValue({ sort: vi.fn().mockReturnValue(sortMock) });
      CallLog.countDocuments.mockResolvedValue(0);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.list({ tags: ['vip', 'urgent'] });

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ tags: { $in: ['vip', 'urgent'] } }),
      );
    });
  });

  // ── get ────────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns call log by callLogId', async () => {
      const doc = makeCallLogDoc();
      const CallLog = makeCallLogModel(doc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.get('call-1');
      expect(result.callLogId).toBe('call-1');
    });

    it('throws CallLogNotFoundError if not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.get('no-call')).rejects.toThrow(CallLogNotFoundError);
    });
  });

  // ── getFollowUpsDue ────────────────────────────────────────────────────────

  describe('getFollowUpsDue()', () => {
    it('queries for overdue follow-ups that are not closed and not notified', async () => {
      const CallLog = makeCallLogModel();
      const sortMock = { sort: vi.fn().mockResolvedValue([]) };
      CallLog.find.mockReturnValue(sortMock);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.getFollowUpsDue();

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({
          isClosed: false,
          followUpNotifiedAt: null,
        }),
      );
    });

    it('filters by agentId when provided', async () => {
      const CallLog = makeCallLogModel();
      CallLog.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.getFollowUpsDue('agent-1');

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-1' }),
      );
    });
  });

  // ── bulkChangeStage ────────────────────────────────────────────────────────

  describe('bulkChangeStage()', () => {
    it('returns summary with succeeded and failed', async () => {
      const callLogDoc = makeCallLogDoc();
      const updatedDoc = makeCallLogDoc({ currentStageId: 'stage-2' });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.bulkChangeStage(['call-1'], 'stage-2', 'agent-1');

      expect(result.total).toBe(1);
      expect(result.succeeded).toContain('call-1');
      expect(result.failed).toHaveLength(0);
    });

    it('records failed entries when changeStage throws', async () => {
      const callLogDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(callLogDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.bulkChangeStage(['call-1'], 'stage-2', 'agent-1');

      expect(result.total).toBe(1);
      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].callLogId).toBe('call-1');
    });
  });

  // ── reopen ─────────────────────────────────────────────────────────────────

  describe('reopen()', () => {
    it('reopens a closed call log and returns an open call log', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true, closedAt: new Date() });
      const reopenedDoc = makeCallLogDoc({ isClosed: false, closedAt: undefined });
      const CallLog = makeCallLogModel(closedDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(reopenedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.reopen('call-1', 'agent-1');

      expect(result.isClosed).toBe(false);
      expect(mockHooks.onCallCreated).not.toHaveBeenCalled();
    });

    it('throws CallLogClosedError if the call is NOT closed (can only reopen closed calls)', async () => {
      const openDoc = makeCallLogDoc({ isClosed: false });
      const CallLog = makeCallLogModel(openDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.reopen('call-1', 'agent-1')).rejects.toThrow(CallLogClosedError);
    });

    it('throws CallLogNotFoundError if not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.reopen('no-call', 'agent-1')).rejects.toThrow(CallLogNotFoundError);
    });

    it('adds a System timeline entry with CallReopened content', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const reopenedDoc = makeCallLogDoc({ isClosed: false });
      const CallLog = makeCallLogModel(closedDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(reopenedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.reopen('call-1', 'agent-1');

      expect(CallLog.findOneAndUpdate).toHaveBeenCalledWith(
        { callLogId: 'call-1' },
        expect.objectContaining({
          $push: expect.objectContaining({
            timeline: expect.objectContaining({
              $each: expect.arrayContaining([
                expect.objectContaining({ type: TimelineEntryType.System }),
              ]),
            }),
          }),
        }),
        { new: true },
      );
    });
  });

  // ── close ──────────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('manually closes an open call log', async () => {
      const callLogDoc = makeCallLogDoc();
      const closedDoc = makeCallLogDoc({ isClosed: true, closedAt: new Date() });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(closedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.close('call-1', 'agent-1');

      expect(result.isClosed).toBe(true);
    });

    it('fires onCallClosed hook', async () => {
      const callLogDoc = makeCallLogDoc();
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(closedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.close('call-1', 'agent-1');

      expect(mockHooks.onCallClosed).toHaveBeenCalledTimes(1);
    });

    it('throws CallLogClosedError if already closed', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(closedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.close('call-1', 'agent-1')).rejects.toThrow(CallLogClosedError);
    });

    it('throws CallLogNotFoundError if not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.close('no-call', 'agent-1')).rejects.toThrow(CallLogNotFoundError);
    });
  });
});
