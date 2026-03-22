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
import { TimelineEntryType } from '@astralibx/call-log-types';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import type { IPipelineDocument } from '../schemas/pipeline.schema.js';
import type { TimelineService } from './timeline.service.js';
import { CallLogNotFoundError, CallLogClosedError, PipelineNotFoundError, StageNotFoundError } from '../errors/index.js';
import { SYSTEM_TIMELINE, SYSTEM_TIMELINE_FN } from '../constants/index.js';
import type { BulkChangeStageResult } from './call-log.service.js';

// ── Re-export for convenience ─────────────────────────────────────────────────
export type { BulkChangeStageResult };

type ResolvedHooks = NonNullable<CallLogEngineConfig['hooks']>;

// ── Service ───────────────────────────────────────────────────────────────────

export class CallLogLifecycleService {
  constructor(
    private CallLog: Model<ICallLogDocument>,
    private Pipeline: Model<IPipelineDocument>,
    private timeline: TimelineService,
    private logger: LogAdapter,
    private hooks: ResolvedHooks,
    private options: ResolvedOptions,
  ) {}

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

  async getFollowUpsDue(agentId?: string, dateRange?: DateRange): Promise<ICallLogDocument[]> {
    const now = new Date();
    const query: Record<string, unknown> = {
      nextFollowUpDate: { $lte: now },
      isClosed: false,
      followUpNotifiedAt: null,
      isDeleted: { $ne: true },
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

  async softDelete(callLogId: string, agentId?: string, agentName?: string): Promise<ICallLogDocument> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);

    const now = new Date();
    const deleteEntry: ITimelineEntry = {
      entryId: crypto.randomUUID(),
      type: TimelineEntryType.System,
      content: agentName
        ? SYSTEM_TIMELINE_FN.callDeleted(agentName)
        : SYSTEM_TIMELINE_FN.callDeleted(agentId ?? 'unknown'),
      authorId: agentId,
      createdAt: now,
    };

    const updated = await this.CallLog.findOneAndUpdate(
      { callLogId },
      {
        $set: { isDeleted: true, deletedAt: now },
        $push: {
          timeline: {
            $each: [deleteEntry],
            $slice: -this.options.maxTimelineEntries,
          },
        },
      },
      { new: true },
    );

    if (!updated) throw new CallLogNotFoundError(callLogId);
    this.logger.info('Call log soft deleted', { callLogId });
    return updated;
  }
}
