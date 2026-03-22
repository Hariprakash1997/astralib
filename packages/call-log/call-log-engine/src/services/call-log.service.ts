import crypto from 'node:crypto';
import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type {
  ICallLog,
  ITimelineEntry,
  ResolvedOptions,
  CallLogEngineConfig,
  DateRange,
} from '@astralibx/call-log-types';
import { TimelineEntryType, CallPriority } from '@astralibx/call-log-types';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import type { IPipelineDocument } from '../schemas/pipeline.schema.js';
import type { TimelineService } from './timeline.service.js';
import { CallLogNotFoundError, CallLogClosedError, PipelineNotFoundError } from '../errors/index.js';
import { SYSTEM_TIMELINE, SYSTEM_TIMELINE_FN } from '../constants/index.js';

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateCallLogInput {
  pipelineId: string;
  contactRef: ICallLog['contactRef'];
  direction: ICallLog['direction'];
  channel: string;
  outcome: string;
  callDate?: Date | string;
  agentId: string;
  priority?: ICallLog['priority'];
  tags?: string[];
  category?: string;
  nextFollowUpDate?: Date;
  durationMinutes?: number;
  isFollowUp?: boolean;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCallLogInput {
  priority?: ICallLog['priority'];
  tags?: string[];
  category?: string;
  nextFollowUpDate?: Date;
  durationMinutes?: number;
  channel?: string;
  outcome?: string;
  isFollowUp?: boolean;
}

export interface ListCallLogsFilter {
  pipelineId?: string;
  currentStageId?: string;
  agentId?: string;
  tags?: string[];
  category?: string;
  isClosed?: boolean;
  includeDeleted?: boolean;
  contactExternalId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  priority?: ICallLog['priority'];
  direction?: ICallLog['direction'];
  channel?: string;
  outcome?: string;
  isFollowUp?: boolean;
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

    const timelineEntries: ITimelineEntry[] = [initialEntry];

    // If this is a follow-up call, add a system timeline entry
    if (data.isFollowUp) {
      const followUpEntry: ITimelineEntry = {
        entryId: crypto.randomUUID(),
        type: TimelineEntryType.System,
        content: SYSTEM_TIMELINE_FN.followUpCallCreated(),
        createdAt: new Date(),
      };
      timelineEntries.push(followUpEntry);
    }

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
      channel: data.channel,
      outcome: data.outcome,
      isFollowUp: data.isFollowUp ?? false,
      timeline: timelineEntries,
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
    if (data.channel !== undefined) setFields.channel = data.channel;
    if (data.outcome !== undefined) setFields.outcome = data.outcome;
    if (data.isFollowUp !== undefined) setFields.isFollowUp = data.isFollowUp;

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
    if (filter.channel) query.channel = filter.channel;
    if (filter.outcome) query.outcome = filter.outcome;
    if (filter.isFollowUp !== undefined) query.isFollowUp = filter.isFollowUp;

    // Exclude deleted by default unless includeDeleted is explicitly true
    if (!filter.includeDeleted) query.isDeleted = { $ne: true };

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
    const callLog = await this.CallLog.findOne({ callLogId, isDeleted: { $ne: true } });
    if (!callLog) throw new CallLogNotFoundError(callLogId);
    return callLog;
  }

  async getByContact(externalId: string): Promise<ICallLogDocument[]> {
    return this.CallLog.find({ 'contactRef.externalId': externalId, isDeleted: { $ne: true } }).sort({ callDate: -1 });
  }
}
