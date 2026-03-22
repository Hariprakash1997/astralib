export enum CallDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
}

export enum CallPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum TimelineEntryType {
  Note = 'note',
  StageChange = 'stage_change',
  Assignment = 'assignment',
  FollowUpSet = 'follow_up_set',
  FollowUpCompleted = 'follow_up_completed',
  System = 'system',
}
