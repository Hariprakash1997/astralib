// Error Codes
export const ERROR_CODE = {
  PipelineNotFound: 'CALL_PIPELINE_NOT_FOUND',
  InvalidPipeline: 'CALL_INVALID_PIPELINE',
  StageNotFound: 'CALL_STAGE_NOT_FOUND',
  StageInUse: 'CALL_STAGE_IN_USE',
  CallLogNotFound: 'CALL_LOG_NOT_FOUND',
  CallLogClosed: 'CALL_LOG_CLOSED',
  ContactNotFound: 'CALL_CONTACT_NOT_FOUND',
  AgentCapacityFull: 'CALL_AGENT_CAPACITY_FULL',
  InvalidConfig: 'CALL_INVALID_CONFIG',
  AuthFailed: 'CALL_AUTH_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

// Error Messages
export const ERROR_MESSAGE = {
  PipelineNotFound: 'Pipeline not found',
  PipelineNoDefaultStage: 'Pipeline must have exactly one default stage',
  PipelineNoTerminalStage: 'Pipeline must have at least one terminal stage',
  PipelineDuplicateStageNames: 'Stage names must be unique within a pipeline',
  StageNotFound: 'Stage not found in pipeline',
  StageInUse: 'Cannot remove stage that has active calls',
  CallLogNotFound: 'Call log not found',
  CallLogClosed: 'Cannot modify a closed call log',
  ContactNotFound: 'Contact not found',
  AgentCapacityFull: 'Agent has reached maximum concurrent calls',
  AuthFailed: 'Authentication failed',
} as const;

// Pipeline Defaults
export const PIPELINE_DEFAULTS = {
  MaxStages: 20,
} as const;

// Call Log Defaults
export const CALL_LOG_DEFAULTS = {
  MaxTimelineEntries: 200,
  DefaultFollowUpDays: 3,
  TimelinePageSize: 20,
} as const;

// Agent Call Defaults
export const AGENT_CALL_DEFAULTS = {
  MaxConcurrentCalls: 10,
} as const;

// System Timeline Messages
export const SYSTEM_TIMELINE = {
  CallCreated: 'Call log created',
  CallClosed: 'Call closed',
  CallReopened: 'Call reopened',
  FollowUpCompleted: 'Follow-up completed',
} as const;

export const SYSTEM_TIMELINE_FN = {
  stageChanged: (from: string, to: string) => `Stage changed from "${from}" to "${to}"`,
  callAssigned: (agentName: string) => `Call assigned to ${agentName}`,
  callReassigned: (from: string, to: string) => `Call reassigned from ${from} to ${to}`,
  followUpSet: (date: string) => `Follow-up scheduled for ${date}`,
} as const;
