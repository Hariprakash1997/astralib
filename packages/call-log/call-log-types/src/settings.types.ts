export interface IPriorityConfig {
  value: string;
  label: string;
  color: string;
  order: number;
}

export interface ICallLogSettings {
  key: 'global';
  availableTags: string[];
  availableCategories: string[];
  availableChannels: string[];
  availableOutcomes: string[];
  priorityLevels: IPriorityConfig[];
  defaultFollowUpDays: number;
  followUpReminderEnabled: boolean;
  defaultPipelineId?: string;
  timelinePageSize: number;
  maxConcurrentCalls: number;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}
