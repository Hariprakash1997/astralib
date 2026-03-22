import crypto from 'node:crypto';
import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { ITimelineEntry } from '@astralibx/call-log-types';
import { TimelineEntryType } from '@astralibx/call-log-types';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import type { ResolvedOptions } from '@astralibx/call-log-types';
import { CallLogNotFoundError, CallLogClosedError } from '../errors/index.js';

// ── Service ───────────────────────────────────────────────────────────────────

export class TimelineService {
  constructor(
    private CallLog: Model<ICallLogDocument>,
    private logger: LogAdapter,
    private options: ResolvedOptions,
  ) {}

  async addNote(
    callLogId: string,
    content: string,
    authorId: string,
    authorName: string,
  ): Promise<ITimelineEntry> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);
    if (callLog.isClosed) throw new CallLogClosedError(callLogId, 'add note');

    const entry: ITimelineEntry = {
      entryId: crypto.randomUUID(),
      type: TimelineEntryType.Note,
      content,
      authorId,
      authorName,
      createdAt: new Date(),
    };

    await this.CallLog.updateOne(
      { callLogId },
      {
        $push: {
          timeline: {
            $each: [entry],
            $slice: -this.options.maxTimelineEntries,
          },
        },
      },
    );

    this.logger.info('Note added to call log', { callLogId, entryId: entry.entryId });
    return entry;
  }

  async addSystemEntry(callLogId: string, content: string): Promise<ITimelineEntry> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);

    const entry: ITimelineEntry = {
      entryId: crypto.randomUUID(),
      type: TimelineEntryType.System,
      content,
      createdAt: new Date(),
    };

    await this.CallLog.updateOne(
      { callLogId },
      {
        $push: {
          timeline: {
            $each: [entry],
            $slice: -this.options.maxTimelineEntries,
          },
        },
      },
    );

    this.logger.info('System entry added to call log', { callLogId, entryId: entry.entryId });
    return entry;
  }

  async getTimeline(
    callLogId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ entries: ITimelineEntry[]; total: number }> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);

    const total = callLog.timeline.length;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // Return in reverse chronological order (newest first), paginated
    const reversed = [...callLog.timeline].reverse();
    const entries = reversed.slice(skip, skip + limit) as ITimelineEntry[];

    return { entries, total };
  }

  async getContactTimeline(
    externalId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ entries: (ITimelineEntry & { callLogId: string })[]; total: number }> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const countResult = await this.CallLog.aggregate<{ total: number }>([
      { $match: { 'contactRef.externalId': externalId } },
      { $unwind: '$timeline' },
      { $count: 'total' },
    ]);
    const total = countResult[0]?.total ?? 0;

    const results = await this.CallLog.aggregate<ITimelineEntry & { callLogId: string }>([
      { $match: { 'contactRef.externalId': externalId } },
      { $unwind: '$timeline' },
      { $sort: { 'timeline.createdAt': -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          'timeline.callLogId': '$callLogId',
        },
      },
      { $replaceRoot: { newRoot: '$timeline' } },
    ]);

    this.logger.info('Contact timeline fetched', { externalId, total, page, limit });
    return { entries: results, total };
  }
}
