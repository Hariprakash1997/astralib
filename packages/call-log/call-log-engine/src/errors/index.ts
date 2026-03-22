import { AlxError } from '@astralibx/core';
import { ERROR_CODE } from '../constants/index.js';

// ── Base ────────────────────────────────────────────────────────────────────

export class AlxCallLogError extends AlxError {
  constructor(message: string, code: string, public readonly context?: Record<string, unknown>) {
    super(message, code);
    this.name = 'AlxCallLogError';
  }
}

// ── Domain errors ───────────────────────────────────────────────────────────

export class PipelineNotFoundError extends AlxCallLogError {
  constructor(public readonly pipelineId: string) {
    super(`Pipeline not found: ${pipelineId}`, ERROR_CODE.PipelineNotFound, { pipelineId });
    this.name = 'PipelineNotFoundError';
  }
}

export class InvalidPipelineError extends AlxCallLogError {
  constructor(
    public readonly reason: string,
    public readonly pipelineId?: string,
  ) {
    super(
      pipelineId
        ? `Invalid pipeline "${pipelineId}": ${reason}`
        : `Invalid pipeline: ${reason}`,
      ERROR_CODE.InvalidPipeline,
      { pipelineId, reason },
    );
    this.name = 'InvalidPipelineError';
  }
}

export class StageNotFoundError extends AlxCallLogError {
  constructor(
    public readonly pipelineId: string,
    public readonly stageId: string,
  ) {
    super(
      `Stage "${stageId}" not found in pipeline "${pipelineId}"`,
      ERROR_CODE.StageNotFound,
      { pipelineId, stageId },
    );
    this.name = 'StageNotFoundError';
  }
}

export class StageInUseError extends AlxCallLogError {
  constructor(
    public readonly pipelineId: string,
    public readonly stageId: string,
    public readonly activeCallCount: number,
  ) {
    super(
      `Cannot remove stage "${stageId}" in pipeline "${pipelineId}": ${activeCallCount} active call(s)`,
      ERROR_CODE.StageInUse,
      { pipelineId, stageId, activeCallCount },
    );
    this.name = 'StageInUseError';
  }
}

export class CallLogNotFoundError extends AlxCallLogError {
  constructor(public readonly callLogId: string) {
    super(`Call log not found: ${callLogId}`, ERROR_CODE.CallLogNotFound, { callLogId });
    this.name = 'CallLogNotFoundError';
  }
}

export class CallLogClosedError extends AlxCallLogError {
  constructor(
    public readonly callLogId: string,
    public readonly attemptedAction: string,
  ) {
    super(
      `Cannot ${attemptedAction} on closed call log "${callLogId}"`,
      ERROR_CODE.CallLogClosed,
      { callLogId, attemptedAction },
    );
    this.name = 'CallLogClosedError';
  }
}

export class ContactNotFoundError extends AlxCallLogError {
  constructor(public readonly contactQuery: Record<string, unknown>) {
    super(
      `Contact not found: ${JSON.stringify(contactQuery)}`,
      ERROR_CODE.ContactNotFound,
      { contactQuery },
    );
    this.name = 'ContactNotFoundError';
  }
}

export class AgentCapacityError extends AlxCallLogError {
  constructor(
    public readonly agentId: string,
    public readonly currentCalls: number,
    public readonly maxCalls: number,
  ) {
    super(
      `Agent ${agentId} at capacity (${currentCalls}/${maxCalls})`,
      ERROR_CODE.AgentCapacityFull,
      { agentId, currentCalls, maxCalls },
    );
    this.name = 'AgentCapacityError';
  }
}

export class InvalidConfigError extends AlxCallLogError {
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`Invalid config for "${field}": ${reason}`, ERROR_CODE.InvalidConfig, { field, reason });
    this.name = 'InvalidConfigError';
  }
}

export class AuthFailedError extends AlxCallLogError {
  constructor(public readonly reason?: string) {
    super(
      reason ? `Authentication failed: ${reason}` : 'Authentication failed',
      ERROR_CODE.AuthFailed,
      { reason },
    );
    this.name = 'AuthFailedError';
  }
}
