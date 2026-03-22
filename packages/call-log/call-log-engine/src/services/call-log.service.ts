import crypto from 'node:crypto';
import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type {
  ICallLog,
  ITimelineEntry,
  IStageChange,
  ResolvedOptions,
  CallLogEngineConfig,
  DateRange,
} from '@astralibx/call-log-types';
import { TimelineEntryType, CallPriority } from '@astralibx/call-log-types';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import type { IPipelineDocument } from '../schemas/pipeline.schema.js';
import type { TimelineService } from './timeline.service.js';
import { CallLogNotFoundError, CallLogClosedError, PipelineNotFoundError, StageNotFoundError } from '../errors/index.js';
import { SYSTEM_TIMELINE, SYSTEM_TIMELINE_FN } from '../constants/index.js';

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateCallLogInput {
  pipelineId: string;
  contactRef: ICallLog['contactRef'];
  direction: ICallLog['direction'];
  callDate?: Date | string;
  agentId: string;
  priority?: ICallLog['priority'];
  tags?: string[];
  category?: string;
  nextFollowUpDate?: Date;
  durationMinutes?: number;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCallLogInput {
  priority?: ICallLog['priority'];
  tags?: string[];
  category?: string;
  nextFollowUpDate?: Date;
  durationMinutes?: number;
}

export interface ListCallLogsFilter {
  pipelineId?: string;
  currentStageId?: string;
  agentId?: string;
  tags?: string[];
  category?: string;
  isClosed?: boolean;
  contactExternalId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  priority?: ICallLog['priority'];
  direction?: ICallLog['direction'];
  dateRange?: DateRange;
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

export interface ListCallLogsResult {
  callLogs: ICallLogDocument[];
  total: number;
  page: number;
  limit: number;
}

export interface BulkChangeStageResult {
  succeeded: string[];
  failed: { callLogId: string; error: string }[];
  total: number;
}

type ResolvedHooks = NonNullable<CallLogEngineConfig['hooks']>;

// ── Service ───────────────────────────────────────────────────────────────────

export class CallLogService {
  constructor(
    private CallLog: Model<ICallLogDocument>,
    private Pipeline: Model<IPipelineDocument>,
    private timeline: TimelineService,
    private logger: LogAdapter,
    private hooks: ResolvedHooks,
    private options: ResolvedOptions,
  ) {}

  async create(data: CreateCallLogInput): Promise<ICallLogDocument> {
    const pipeline = await this.Pipeline.findOne({ pipelineId: data.pipelineId, isDeleted: false });
    if (!pipeline) throw new PipelineNotFoundError(data.pipelineId);

    const defaultStage = pipeline.stages.find((s) => s.isDefault);
    if (!defaultStage) throw new PipelineNotFoundError(data.pipelineId);

    const callLogId = crypto.randomUUID();

    const initialEntry: ITimelineEntry = {
      entryId: crypto.randomUUID(),
      type: TimelineEntryType.System,
      content: SYSTEM_TIMELINE.CallCreated,
      createdAt: new Date(),
    };

    const callLog = await this.CallLog.create({
      callLogId,
      pipelineId: data.pipelineId,
      currentStageId: defaultStage.stageId,
      contactRef: data.contactRef,
      direction: data.direction,
      callDate: data.callDate ? new Date(data.callDate) : new Date(),
      agentId: data.agentId,
      priority: data.priority ?? CallPriority.Medium,
      tags: data.tags ?? [],
      category: data.category,
      nextFollowUpDate: data.nextFollowUpDate,
      durationMinutes: data.durationMinutes,
      timeline: [initialEntry],
      stageHistory: [],
      isClosed: false,
      ...(data.tenantId ? { tenantId: data.tenantId } : {}),
      metadata: data.metadata,
    });

    this.logger.info('Call log created', { callLogId, pipelineId: data.pipelineId });

    if (this.hooks.onCallCreated) {
      await this.hooks.onCallCreated(callLog as unknown as ICallLog);
    }

    return callLog;
  }

  async update(callLogId: string, data: UpdateCallLogInput): Promise<ICallLogDocument> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);
    if (callLog.isClosed) throw new CallLogClosedError(callLogId, 'update');

    const setFields: Record<string, unknown> = {};
    const pushEntries: ITimelineEntry[] = [];

    if (data.priority !== undefined) setFields.priority = data.priority;
    if (data.tags !== undefined) setFields.tags = data.tags;
    if (data.category !== undefined) setFields.category = data.category;
    if (data.durationMinutes !== undefined) setFields.durationMinutes = data.durationMinutes;

    if (data.nextFollowUpDate !== undefined) {
      const prevDate = callLog.nextFollowUpDate?.toISOString();
      const newDate = data.nextFollowUpDate?.toISOString();
      if (prevDate !== newDate) {
        setFields.nextFollowUpDate = data.nextFollowUpDate;
        if (data.nextFollowUpDate) {
          const followUpEntry: ITimelineEntry = {
            entryId: crypto.randomUUID(),
            type: TimelineEntryType.FollowUpSet,
            content: SYSTEM_TIMELINE_FN.followUpSet(new Date(data.nextFollowUpDate).toISOString()),
            createdAt: new Date(),
          };
          pushEntries.push(followUpEntry);
        }
      }
    }

    const updateOp: Record<string, unknown> = { $set: setFields };
    if (pushEntries.length > 0) {
      updateOp.$push = {
        timeline: {
          $each: pushEntries,
          $slice: -this.options.maxTimelineEntries,
        },
      };
    }

    const updated = await this.CallLog.findOneAndUpdate(
      { callLogId },
      updateOp,
      { new: true },
    );

    if (!updated) throw new CallLogNotFoundError(callLogId);
    this.logger.info('Call log updated', { callLogId, fields: Object.keys(data) });
    return updated;
  }

  async changeStage(callLogId: string, newStageId: string, agentId: string): Promise<ICallLogDocument> {
    // First read current state for optimistic lock value and computation
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);
    if (callLog.isClosed) throw new CallLogClosedError(callLogId, 'change stage');

    const currentStageId = callLog.currentStageId;

    // Lookup pipeline and validate stages
    const pipeline = await this.Pipeline.findOne({ pipelineId: callLog.pipelineId, isDeleted: false });
    if (!pipeline) throw new PipelineNotFoundError(callLog.pipelineId);

    const currentStage = pipeline.stages.find((s) => s.stageId === currentStageId);
    if (!currentStage) throw new StageNotFoundError(callLog.pipelineId, currentStageId);

    const newStage = pipeline.stages.find((s) => s.stageId === newStageId);
    if (!newStage) throw new StageNotFoundError(callLog.pipelineId, newStageId);

    // Compute time in current stage
    const now = new Date();
    const lastHistory = callLog.stageHistory[callLog.stageHistory.length - 1];
    const stageStartTime = lastHistory?.changedAt?.getTime() ?? (callLog as unknown as { createdAt: Date }).createdAt?.getTime() ?? now.getTime();
    const timeInStageMs = now.getTime() - stageStartTime;

    const stageChangeEntry: ITimelineEntry = {
      entryId: crypto.randomUUID(),
      type: TimelineEntryType.StageChange,
      content: SYSTEM_TIMELINE_FN.stageChanged(currentStage.name, newStage.name),
      fromStageId: currentStageId,
      fromStageName: currentStage.name,
      toStageId: newStageId,
      toStageName: newStage.name,
      authorId: agentId,
      createdAt: now,
    };

    const stageHistoryEntry: IStageChange = {
      fromStageId: currentStageId,
      toStageId: newStageId,
      fromStageName: currentStage.name,
      toStageName: newStage.name,
      changedBy: agentId,
      changedAt: now,
      timeInStageMs,
    };

    const isTerminal = newStage.isTerminal;

    const closeFields: Record<string, unknown> = isTerminal
      ? { currentStageId: newStageId, isClosed: true, closedAt: now }
      : { currentStageId: newStageId };

    // Atomic update with optimistic concurrency check
    const result = await this.CallLog.findOneAndUpdate(
      { callLogId, currentStageId },
      {
        $set: closeFields,
        $push: {
          stageHistory: stageHistoryEntry,
          timeline: stageChangeEntry,
        },
      },
      { new: true },
    );

    if (!result) {
      // Concurrent change detected
      throw new CallLogClosedError(callLogId, 'change stage (concurrent modification detected)');
    }

    this.logger.info('Call log stage changed', { callLogId, from: currentStageId, to: newStageId });

    if (isTerminal && this.hooks.onCallClosed) {
      await this.hooks.onCallClosed(result as unknown as ICallLog);
    }

    if (this.hooks.onStageChanged) {
      await this.hooks.onStageChanged(result as unknown as ICallLog, currentStage.name, newStage.name);
    }

    return result;
  }

  async assign(callLogId: string, agentId: string, assignedBy: string): Promise<ICallLogDocument> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);

    const previousAgentId = callLog.agentId?.toString();

    const assignmentEntry: ITimelineEntry = {
      entryId: crypto.randomUUID(),
      type: TimelineEntryType.Assignment,
      content: previousAgentId
        ? SYSTEM_TIMELINE_FN.callReassigned(previousAgentId, agentId)
        : SYSTEM_TIMELINE_FN.callAssigned(agentId),
      toAgentId: agentId,
      fromAgentId: previousAgentId,
      authorId: assignedBy,
      createdAt: new Date(),
    };

    const updated = await this.CallLog.findOneAndUpdate(
      { callLogId },
      {
        $set: { agentId, assignedBy },
        $push: {
          timeline: {
            $each: [assignmentEntry],
            $slice: -this.options.maxTimelineEntries,
          },
        },
      },
      { new: true },
    );

    if (!updated) throw new CallLogNotFoundError(callLogId);
    this.logger.info('Call log assigned', { callLogId, agentId, assignedBy });

    if (this.hooks.onCallAssigned) {
      await this.hooks.onCallAssigned(updated as unknown as ICallLog, previousAgentId);
    }

    return updated;
  }

  async list(filter: ListCallLogsFilter = {}): Promise<ListCallLogsResult> {
    const query: Record<string, unknown> = {};

    if (filter.pipelineId) query.pipelineId = filter.pipelineId;
    if (filter.currentStageId) query.currentStageId = filter.currentStageId;
    if (filter.agentId) query.agentId = filter.agentId;
    if (filter.tags && filter.tags.length > 0) query.tags = { $in: filter.tags };
    if (filter.category) query.category = filter.category;
    if (filter.isClosed !== undefined) query.isClosed = filter.isClosed;
    if (filter.contactExternalId) query['contactRef.externalId'] = filter.contactExternalId;
    if (filter.contactName) query['contactRef.displayName'] = { $regex: filter.contactName, $options: 'i' };
    if (filter.contactPhone) query['contactRef.phone'] = { $regex: `^${filter.contactPhone}` };
    if (filter.contactEmail) query['contactRef.email'] = filter.contactEmail;
    if (filter.priority) query.priority = filter.priority;
    if (filter.direction) query.direction = filter.direction;

    if (filter.dateRange?.from || filter.dateRange?.to) {
      const dateFilter: Record<string, unknown> = {};
      if (filter.dateRange.from) dateFilter.$gte = new Date(filter.dateRange.from);
      if (filter.dateRange.to) dateFilter.$lte = new Date(filter.dateRange.to);
      query.callDate = dateFilter;
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;
    const sort = filter.sort ?? { callDate: -1 };

    const [callLogs, total] = await Promise.all([
      this.CallLog.find(query).sort(sort).skip(skip).limit(limit),
      this.CallLog.countDocuments(query),
    ]);

    return { callLogs, total, page, limit };
  }

  async get(callLogId: string): Promise<ICallLogDocument> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);
    return callLog;
  }

  async getByContact(externalId: string): Promise<ICallLogDocument[]> {
    return this.CallLog.find({ 'contactRef.externalId': externalId }).sort({ callDate: -1 });
  }

  async getFollowUpsDue(agentId?: string, dateRange?: DateRange): Promise<ICallLogDocument[]> {
    const now = new Date();
    const query: Record<string, unknown> = {
      nextFollowUpDate: { $lte: now },
      isClosed: false,
      followUpNotifiedAt: null,
    };

    if (agentId) query.agentId = agentId;

    if (dateRange?.from || dateRange?.to) {
      const dateFilter: Record<string, unknown> = {};
      if (dateRange.from) dateFilter.$gte = new Date(dateRange.from);
      if (dateRange.to) dateFilter.$lte = new Date(dateRange.to);
      // Override the nextFollowUpDate filter to include the range
      query.nextFollowUpDate = { ...(query.nextFollowUpDate as object), ...dateFilter };
    }

    return this.CallLog.find(query).sort({ nextFollowUpDate: 1 });
  }

  async bulkChangeStage(
    callLogIds: string[],
    newStageId: string,
    agentId: string,
  ): Promise<BulkChangeStageResult> {
    const succeeded: string[] = [];
    const failed: { callLogId: string; error: string }[] = [];

    for (const callLogId of callLogIds) {
      try {
        await this.changeStage(callLogId, newStageId, agentId);
        succeeded.push(callLogId);
      } catch (err) {
        failed.push({
          callLogId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.info('Bulk stage change completed', {
      total: callLogIds.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });

    return { succeeded, failed, total: callLogIds.length };
  }

  async close(callLogId: string, agentId: string): Promise<ICallLogDocument> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);
    if (callLog.isClosed) throw new CallLogClosedError(callLogId, 'close');

    const now = new Date();
    const closeEntry: ITimelineEntry = {
      entryId: crypto.randomUUID(),
      type: TimelineEntryType.System,
      content: SYSTEM_TIMELINE.CallClosed,
      authorId: agentId,
      createdAt: now,
    };

    const updated = await this.CallLog.findOneAndUpdate(
      { callLogId },
      {
        $set: { isClosed: true, closedAt: now },
        $push: {
          timeline: {
            $each: [closeEntry],
            $slice: -this.options.maxTimelineEntries,
          },
        },
      },
      { new: true },
    );

    if (!updated) throw new CallLogNotFoundError(callLogId);
    this.logger.info('Call log closed', { callLogId, agentId });

    if (this.hooks.onCallClosed) {
      await this.hooks.onCallClosed(updated as unknown as ICallLog);
    }

    return updated;
  }

  async reopen(callLogId: string, agentId: string): Promise<ICallLogDocument> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);
    if (!callLog.isClosed) throw new CallLogClosedError(callLogId, 'reopen');

    const now = new Date();
    const reopenEntry: ITimelineEntry = {
      entryId: crypto.randomUUID(),
      type: TimelineEntryType.System,
      content: SYSTEM_TIMELINE.CallReopened,
      authorId: agentId,
      createdAt: now,
    };

    const updated = await this.CallLog.findOneAndUpdate(
      { callLogId },
      {
        $set: { isClosed: false, closedAt: undefined },
        $push: {
          timeline: {
            $each: [reopenEntry],
            $slice: -this.options.maxTimelineEntries,
          },
        },
      },
      { new: true },
    );

    if (!updated) throw new CallLogNotFoundError(callLogId);
    this.logger.info('Call log reopened', { callLogId, agentId });

    return updated;
  }
}
