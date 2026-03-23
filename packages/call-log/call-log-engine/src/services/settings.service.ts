import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { ICallLogSettings, IPriorityConfig } from '@astralibx/call-log-types';
import type { ICallLogSettingsDocument } from '../schemas/call-log-settings.schema.js';
import { InvalidConfigError } from '../errors/index.js';
import { CALL_LOG_DEFAULTS, AGENT_CALL_DEFAULTS } from '../constants/index.js';


// ── Private validation helpers ────────────────────────────────────────────────

function validateIntegerRange(value: unknown, field: string, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new InvalidConfigError(field, `Must be an integer between ${min} and ${max}`);
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export class SettingsService {
  constructor(
    private CallLogSettings: Model<ICallLogSettingsDocument>,
    private logger: LogAdapter,
    private tenantId?: string,
  ) {}

  private get settingsFilter(): Record<string, unknown> {
    const filter: Record<string, unknown> = { key: 'global' };
    if (this.tenantId) filter.tenantId = this.tenantId;
    return filter;
  }

  private buildDefaults(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {
      key: 'global',
      availableTags: [],
      availableCategories: [],
      priorityLevels: [],
      defaultFollowUpDays: CALL_LOG_DEFAULTS.DefaultFollowUpDays,
      followUpReminderEnabled: true,
      timelinePageSize: CALL_LOG_DEFAULTS.TimelinePageSize,
      maxConcurrentCalls: AGENT_CALL_DEFAULTS.MaxConcurrentCalls,
    };
    if (this.tenantId) defaults.tenantId = this.tenantId;
    return defaults;
  }

  async get(): Promise<ICallLogSettingsDocument> {
    return this.CallLogSettings.findOneAndUpdate(
      this.settingsFilter,
      { $setOnInsert: this.buildDefaults() },
      { upsert: true, new: true },
    ) as Promise<ICallLogSettingsDocument>;
  }

  async update(data: Partial<{
    availableTags: string[];
    availableCategories: string[];
    availableChannels: string[];
    availableOutcomes: string[];
    priorityLevels: IPriorityConfig[];
    defaultFollowUpDays: number;
    followUpReminderEnabled: boolean;
    defaultPipelineId: string;
    timelinePageSize: number;
    maxConcurrentCalls: number;
    metadata: Record<string, unknown>;
  }>): Promise<ICallLogSettingsDocument> {
    if (data.defaultFollowUpDays != null) {
      validateIntegerRange(data.defaultFollowUpDays, 'defaultFollowUpDays', 1, 30);
    }
    if (data.timelinePageSize != null) {
      validateIntegerRange(data.timelinePageSize, 'timelinePageSize', 5, 100);
    }
    if (data.maxConcurrentCalls != null) {
      validateIntegerRange(data.maxConcurrentCalls, 'maxConcurrentCalls', 1, 50);
    }

    const settings = await this.CallLogSettings.findOneAndUpdate(
      this.settingsFilter,
      { $set: data },
      { upsert: true, new: true },
    );
    this.logger.info('Call log settings updated', { fields: Object.keys(data) });
    return settings!;
  }
}
