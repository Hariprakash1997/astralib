import crypto from 'node:crypto';
import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { ICallLog, ResolvedOptions } from '@astralibx/call-log-types';
import { TimelineEntryType } from '@astralibx/call-log-types';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import { SYSTEM_TIMELINE } from '../constants/index.js';

// ── Deps interface ────────────────────────────────────────────────────────────

export interface FollowUpWorkerDeps {
  CallLog: Model<ICallLogDocument>;
  hooks: { onFollowUpDue?: (callLog: ICallLog) => void | Promise<void> };
  logger: LogAdapter;
  options: ResolvedOptions;
}

// ── Worker ────────────────────────────────────────────────────────────────────

export class FollowUpWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private deps: FollowUpWorkerDeps) {}

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick().catch((err) => {
        this.deps.logger.error('Follow-up worker tick failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    }, this.deps.options.followUpCheckIntervalMs);

    this.deps.logger.info('Follow-up worker started', {
      intervalMs: this.deps.options.followUpCheckIntervalMs,
    });
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.deps.logger.info('Follow-up worker stopped');
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const dueCallLogs = await this.deps.CallLog.find({
        nextFollowUpDate: { $lte: new Date() },
        isClosed: false,
        followUpNotifiedAt: null,
      });

      for (const callLog of dueCallLogs) {
        try {
          if (this.deps.hooks.onFollowUpDue) {
            await this.deps.hooks.onFollowUpDue(callLog as unknown as ICallLog);
          }

          await this.deps.CallLog.findOneAndUpdate(
            { _id: callLog._id },
            {
              $set: { followUpNotifiedAt: new Date() },
              $push: {
                timeline: {
                  entryId: crypto.randomUUID(),
                  type: TimelineEntryType.FollowUpCompleted,
                  content: SYSTEM_TIMELINE.FollowUpCompleted,
                  createdAt: new Date(),
                },
              },
            },
          );

          this.deps.logger.info('Follow-up notification fired', {
            callLogId: callLog.callLogId,
          });
        } catch (err) {
          this.deps.logger.error('Failed to process follow-up for call log', {
            callLogId: callLog.callLogId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
