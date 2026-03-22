import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallLogLifecycleService } from '../../services/call-log-lifecycle.service.js';
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
  enableAgentScoping: true,
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
    channel: 'phone',
    outcome: 'pending',
    isFollowUp: false,
    isDeleted: false,
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

describe('CallLogLifecycleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── changeStage ────────────────────────────────────────────────────────────

  describe('changeStage()', () => {
    it('updates currentStageId, adds stageHistory and timeline entry', async () => {
      const callLogDoc = makeCallLogDoc({ stageHistory: [] });
      const updatedDoc = makeCallLogDoc({ currentStageId: 'stage-2', isClosed: true });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.changeStage('call-1', 'stage-2', 'agent-1')).rejects.toThrow(CallLogClosedError);
    });

    it('throws CallLogClosedError if call log is already closed', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(closedDoc);
      const Pipeline = makePipelineModel(makePipeline());
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.assign('call-1', 'new-agent', 'admin-1');

      expect(mockHooks.onCallAssigned).toHaveBeenCalledTimes(1);
    });

    it('throws CallLogNotFoundError if call log not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.assign('no-call', 'agent-2', 'admin-1')).rejects.toThrow(CallLogNotFoundError);
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.reopen('call-1', 'agent-1')).rejects.toThrow(CallLogClosedError);
    });

    it('throws CallLogNotFoundError if not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.close('call-1', 'agent-1');

      expect(mockHooks.onCallClosed).toHaveBeenCalledTimes(1);
    });

    it('throws CallLogClosedError if already closed', async () => {
      const closedDoc = makeCallLogDoc({ isClosed: true });
      const CallLog = makeCallLogModel(closedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.close('call-1', 'agent-1')).rejects.toThrow(CallLogClosedError);
    });

    it('throws CallLogNotFoundError if not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.close('no-call', 'agent-1')).rejects.toThrow(CallLogNotFoundError);
    });
  });

  // ── getFollowUpsDue ────────────────────────────────────────────────────────

  describe('getFollowUpsDue()', () => {
    it('queries for overdue follow-ups that are not closed and not notified', async () => {
      const CallLog = makeCallLogModel();
      const sortMock = { sort: vi.fn().mockResolvedValue([]) };
      CallLog.find.mockReturnValue(sortMock);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
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
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.getFollowUpsDue('agent-1');

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-1' }),
      );
    });

    it('excludes deleted call logs', async () => {
      const CallLog = makeCallLogModel();
      CallLog.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.getFollowUpsDue();

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: { $ne: true } }),
      );
    });
  });

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets isDeleted=true and deletedAt on the call log', async () => {
      const callLogDoc = makeCallLogDoc();
      const deletedDoc = makeCallLogDoc({ isDeleted: true, deletedAt: new Date() });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(deletedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.softDelete('call-1', 'agent-1', 'Agent One');

      expect(result.isDeleted).toBe(true);
      expect(result.deletedAt).toBeDefined();
    });

    it('passes isDeleted=true and deletedAt in the $set', async () => {
      const callLogDoc = makeCallLogDoc();
      const deletedDoc = makeCallLogDoc({ isDeleted: true, deletedAt: new Date() });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(deletedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.softDelete('call-1', 'agent-1', 'Agent One');

      expect(CallLog.findOneAndUpdate).toHaveBeenCalledWith(
        { callLogId: 'call-1' },
        expect.objectContaining({
          $set: expect.objectContaining({
            isDeleted: true,
            deletedAt: expect.any(Date),
          }),
        }),
        { new: true },
      );
    });

    it('adds a System timeline entry on soft delete', async () => {
      const callLogDoc = makeCallLogDoc();
      const deletedDoc = makeCallLogDoc({ isDeleted: true, deletedAt: new Date() });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(deletedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.softDelete('call-1', 'agent-1', 'Agent One');

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

    it('throws CallLogNotFoundError if call log not found', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.softDelete('no-call', 'agent-1')).rejects.toThrow(CallLogNotFoundError);
    });

    it('throws CallLogNotFoundError if findOneAndUpdate returns null', async () => {
      const callLogDoc = makeCallLogDoc();
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.softDelete('call-1')).rejects.toThrow(CallLogNotFoundError);
    });

    it('works without agentId and agentName', async () => {
      const callLogDoc = makeCallLogDoc();
      const deletedDoc = makeCallLogDoc({ isDeleted: true, deletedAt: new Date() });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(deletedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogLifecycleService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      const result = await service.softDelete('call-1');

      expect(result.isDeleted).toBe(true);
    });
  });
});
