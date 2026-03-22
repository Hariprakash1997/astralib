import { CallDirection, CallPriority, TimelineEntryType } from './enums';

export interface IContactRef {
  externalId: string;
  displayName: string;
  phone?: string;
  email?: string;
}

export interface IStageChange {
  fromStageId: string;
  toStageId: string;
  fromStageName: string;
  toStageName: string;
  changedBy: string;
  changedAt: Date;
  timeInStageMs: number;
}

export interface ITimelineEntry {
  entryId: string;
  type: TimelineEntryType;
  content?: string;
  authorId?: string;
  authorName?: string;
  fromStageId?: string;
  fromStageName?: string;
  toStageId?: string;
  toStageName?: string;
  fromAgentId?: string;
  fromAgentName?: string;
  toAgentId?: string;
  toAgentName?: string;
  createdAt: Date;
}

export interface ICallLog {
  callLogId: string;
  pipelineId: string;
  currentStageId: string;
  contactRef: IContactRef;
  direction: CallDirection;
  callDate: Date;
  nextFollowUpDate?: Date;
  followUpNotifiedAt?: Date;
  priority: CallPriority;
  agentId: string; // string here because types package has no Mongoose dep; schema uses Schema.Types.ObjectId
  assignedBy?: string;
  tags: string[];
  category?: string;
  timeline: ITimelineEntry[];
  stageHistory: IStageChange[];
  durationMinutes?: number;
  channel: string;
  outcome: string;
  isFollowUp: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  isClosed: boolean;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCallLogInput {
  pipelineId: string;
  contactRef: IContactRef;
  direction: CallDirection;
  callDate: Date;
  channel: string;
  outcome: string;
  priority?: CallPriority;
  agentId: string;
  tags?: string[];
  category?: string;
  durationMinutes?: number;
  nextFollowUpDate?: Date;
  isFollowUp?: boolean;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCallLogInput {
  currentStageId?: string;
  direction?: CallDirection;
  callDate?: Date;
  channel?: string;
  outcome?: string;
  isFollowUp?: boolean;
  priority?: CallPriority;
  agentId?: string;
  assignedBy?: string;
  tags?: string[];
  category?: string;
  durationMinutes?: number;
  nextFollowUpDate?: Date;
  isClosed?: boolean;
  closedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ListCallLogsFilter {
  pipelineId?: string;
  agentId?: string;
  direction?: CallDirection;
  priority?: CallPriority;
  channel?: string;
  outcome?: string;
  isFollowUp?: boolean;
  isClosed?: boolean;
  includeDeleted?: boolean;
  tenantId?: string;
  tags?: string[];
  category?: string;
  callDateFrom?: Date;
  callDateTo?: Date;
  limit?: number;
  skip?: number;
}
