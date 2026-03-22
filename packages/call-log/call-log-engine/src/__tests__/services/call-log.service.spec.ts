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
        channel: 'phone',
        outcome: 'pending',
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
        channel: 'phone',
        outcome: 'pending',
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
        channel: 'phone',
        outcome: 'pending',
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
          channel: 'phone',
          outcome: 'pending',
          callDate: new Date(),
          agentId: 'agent-1',
        }),
      ).rejects.toThrow(PipelineNotFoundError);
    });

    it('sets channel and outcome on created document', async () => {
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
        channel: 'whatsapp',
        outcome: 'resolved',
        agentId: 'agent-1',
      });

      expect(createdData.channel).toBe('whatsapp');
      expect(createdData.outcome).toBe('resolved');
    });

    it('adds follow-up timeline entry when isFollowUp=true', async () => {
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
        channel: 'phone',
        outcome: 'pending',
        agentId: 'agent-1',
        isFollowUp: true,
      });

      const timeline = createdData.timeline as ITimelineEntry[];
      expect(timeline).toHaveLength(2);
      expect(timeline[1].type).toBe(TimelineEntryType.System);
      expect(timeline[1].content).toContain('follow-up');
    });

    it('sets isFollowUp=false by default', async () => {
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
        channel: 'phone',
        outcome: 'pending',
        agentId: 'agent-1',
      });

      expect(createdData.isFollowUp).toBe(false);
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

    it('can update channel, outcome, and isFollowUp', async () => {
      const callLogDoc = makeCallLogDoc();
      const updatedDoc = makeCallLogDoc({ channel: 'email', outcome: 'resolved', isFollowUp: true });
      const CallLog = makeCallLogModel(callLogDoc);
      CallLog.findOneAndUpdate.mockResolvedValue(updatedDoc);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await service.update('call-1', { channel: 'email', outcome: 'resolved', isFollowUp: true });

      expect(CallLog.findOneAndUpdate).toHaveBeenCalledWith(
        { callLogId: 'call-1' },
        expect.objectContaining({
          $set: expect.objectContaining({
            channel: 'email',
            outcome: 'resolved',
            isFollowUp: true,
          }),
        }),
        { new: true },
      );
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

    it('filters by channel, outcome, and isFollowUp', async () => {
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

      await service.list({ channel: 'whatsapp', outcome: 'resolved', isFollowUp: true });

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'whatsapp',
          outcome: 'resolved',
          isFollowUp: true,
        }),
      );
    });

    it('excludes deleted by default', async () => {
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

      await service.list({});

      expect(CallLog.find).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: { $ne: true } }),
      );
    });

    it('includes deleted when includeDeleted=true', async () => {
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

      await service.list({ includeDeleted: true });

      // isDeleted filter should NOT be present
      expect(CallLog.find).toHaveBeenCalledWith(
        expect.not.objectContaining({ isDeleted: expect.anything() }),
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

    it('excludes deleted calls', async () => {
      const CallLog = makeCallLogModel(null);
      const Pipeline = makePipelineModel();
      const service = new CallLogService(
        CallLog as any, Pipeline as any, mockTimeline as any, mockLogger, mockHooks, defaultOptions,
      );

      await expect(service.get('call-1')).rejects.toThrow(CallLogNotFoundError);

      expect(CallLog.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: { $ne: true } }),
      );
    });
  });
});
