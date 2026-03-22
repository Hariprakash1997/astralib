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
  isClosed: boolean;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}
