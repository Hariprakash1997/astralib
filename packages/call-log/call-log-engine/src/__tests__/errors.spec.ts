import { describe, it, expect } from 'vitest';
import { AlxError } from '@astralibx/core';
import {
  AlxCallLogError,
  PipelineNotFoundError,
  InvalidPipelineError,
  StageNotFoundError,
  StageInUseError,
  CallLogNotFoundError,
  CallLogClosedError,
  ContactNotFoundError,
  AgentCapacityError,
  InvalidConfigError,
  AuthFailedError,
} from '../errors/index.js';
import { ERROR_CODE } from '../constants/index.js';

describe('AlxCallLogError (base)', () => {
  it('is instanceof AlxError', () => {
    const err = new AlxCallLogError('test', 'CALL_TEST');
    expect(err).toBeInstanceOf(AlxError);
  });

  it('is instanceof AlxCallLogError', () => {
    const err = new AlxCallLogError('test', 'CALL_TEST');
    expect(err).toBeInstanceOf(AlxCallLogError);
  });

  it('has correct code', () => {
    const err = new AlxCallLogError('test', 'CALL_TEST');
    expect(err.code).toBe('CALL_TEST');
  });

  it('accepts optional context', () => {
    const err = new AlxCallLogError('test', 'CALL_TEST', { foo: 'bar' });
    expect(err.context).toEqual({ foo: 'bar' });
  });
});

describe('PipelineNotFoundError', () => {
  it('has correct code', () => {
    const err = new PipelineNotFoundError('pipe-123');
    expect(err.code).toBe(ERROR_CODE.PipelineNotFound);
  });

  it('message contains pipelineId', () => {
    const err = new PipelineNotFoundError('pipe-123');
    expect(err.message).toContain('pipe-123');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new PipelineNotFoundError('pipe-123');
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains pipelineId', () => {
    const err = new PipelineNotFoundError('pipe-123');
    expect(err.context).toEqual({ pipelineId: 'pipe-123' });
  });
});

describe('InvalidPipelineError', () => {
  it('has correct code', () => {
    const err = new InvalidPipelineError('no default stage');
    expect(err.code).toBe(ERROR_CODE.InvalidPipeline);
  });

  it('message contains reason', () => {
    const err = new InvalidPipelineError('no default stage');
    expect(err.message).toContain('no default stage');
  });

  it('message contains pipelineId when provided', () => {
    const err = new InvalidPipelineError('no default stage', 'pipe-abc');
    expect(err.message).toContain('pipe-abc');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new InvalidPipelineError('reason');
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains reason and optional pipelineId', () => {
    const err = new InvalidPipelineError('reason', 'pipe-abc');
    expect(err.context).toMatchObject({ reason: 'reason', pipelineId: 'pipe-abc' });
  });
});

describe('StageNotFoundError', () => {
  it('has correct code', () => {
    const err = new StageNotFoundError('pipe-1', 'stage-1');
    expect(err.code).toBe(ERROR_CODE.StageNotFound);
  });

  it('message contains pipelineId and stageId', () => {
    const err = new StageNotFoundError('pipe-1', 'stage-1');
    expect(err.message).toContain('pipe-1');
    expect(err.message).toContain('stage-1');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new StageNotFoundError('pipe-1', 'stage-1');
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains pipelineId and stageId', () => {
    const err = new StageNotFoundError('pipe-1', 'stage-1');
    expect(err.context).toEqual({ pipelineId: 'pipe-1', stageId: 'stage-1' });
  });
});

describe('StageInUseError', () => {
  it('has correct code', () => {
    const err = new StageInUseError('pipe-1', 'stage-1', 5);
    expect(err.code).toBe(ERROR_CODE.StageInUse);
  });

  it('message contains pipelineId, stageId, and activeCallCount', () => {
    const err = new StageInUseError('pipe-1', 'stage-1', 5);
    expect(err.message).toContain('pipe-1');
    expect(err.message).toContain('stage-1');
    expect(err.message).toContain('5');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new StageInUseError('pipe-1', 'stage-1', 5);
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains all fields', () => {
    const err = new StageInUseError('pipe-1', 'stage-1', 5);
    expect(err.context).toEqual({ pipelineId: 'pipe-1', stageId: 'stage-1', activeCallCount: 5 });
  });
});

describe('CallLogNotFoundError', () => {
  it('has correct code', () => {
    const err = new CallLogNotFoundError('log-123');
    expect(err.code).toBe(ERROR_CODE.CallLogNotFound);
  });

  it('message contains callLogId', () => {
    const err = new CallLogNotFoundError('log-123');
    expect(err.message).toContain('log-123');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new CallLogNotFoundError('log-123');
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains callLogId', () => {
    const err = new CallLogNotFoundError('log-123');
    expect(err.context).toEqual({ callLogId: 'log-123' });
  });
});

describe('CallLogClosedError', () => {
  it('has correct code', () => {
    const err = new CallLogClosedError('log-123', 'add note');
    expect(err.code).toBe(ERROR_CODE.CallLogClosed);
  });

  it('message contains callLogId and attemptedAction', () => {
    const err = new CallLogClosedError('log-123', 'add note');
    expect(err.message).toContain('log-123');
    expect(err.message).toContain('add note');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new CallLogClosedError('log-123', 'add note');
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains callLogId and attemptedAction', () => {
    const err = new CallLogClosedError('log-123', 'add note');
    expect(err.context).toEqual({ callLogId: 'log-123', attemptedAction: 'add note' });
  });
});

describe('ContactNotFoundError', () => {
  it('has correct code', () => {
    const err = new ContactNotFoundError({ phone: '+1234567890' });
    expect(err.code).toBe(ERROR_CODE.ContactNotFound);
  });

  it('message contains contact query info', () => {
    const err = new ContactNotFoundError({ phone: '+1234567890' });
    expect(err.message).toContain('+1234567890');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new ContactNotFoundError({ phone: '+1234567890' });
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains contactQuery', () => {
    const query = { phone: '+1234567890' };
    const err = new ContactNotFoundError(query);
    expect(err.context).toEqual({ contactQuery: query });
  });
});

describe('AgentCapacityError', () => {
  it('has correct code', () => {
    const err = new AgentCapacityError('agent-1', 10, 10);
    expect(err.code).toBe(ERROR_CODE.AgentCapacityFull);
  });

  it('message contains agentId and capacity info', () => {
    const err = new AgentCapacityError('agent-1', 10, 10);
    expect(err.message).toContain('agent-1');
    expect(err.message).toContain('10');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new AgentCapacityError('agent-1', 10, 10);
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains agentId, currentCalls, maxCalls', () => {
    const err = new AgentCapacityError('agent-1', 8, 10);
    expect(err.context).toEqual({ agentId: 'agent-1', currentCalls: 8, maxCalls: 10 });
  });
});

describe('InvalidConfigError', () => {
  it('has correct code', () => {
    const err = new InvalidConfigError('maxStages', 'must be > 0');
    expect(err.code).toBe(ERROR_CODE.InvalidConfig);
  });

  it('message contains field and reason', () => {
    const err = new InvalidConfigError('maxStages', 'must be > 0');
    expect(err.message).toContain('maxStages');
    expect(err.message).toContain('must be > 0');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new InvalidConfigError('maxStages', 'must be > 0');
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains field and reason', () => {
    const err = new InvalidConfigError('maxStages', 'must be > 0');
    expect(err.context).toEqual({ field: 'maxStages', reason: 'must be > 0' });
  });
});

describe('AuthFailedError', () => {
  it('has correct code', () => {
    const err = new AuthFailedError();
    expect(err.code).toBe(ERROR_CODE.AuthFailed);
  });

  it('message is generic when no reason provided', () => {
    const err = new AuthFailedError();
    expect(err.message).toContain('Authentication failed');
  });

  it('message contains reason when provided', () => {
    const err = new AuthFailedError('invalid token');
    expect(err.message).toContain('invalid token');
  });

  it('is instanceof AlxCallLogError and AlxError', () => {
    const err = new AuthFailedError();
    expect(err).toBeInstanceOf(AlxCallLogError);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('context contains reason', () => {
    const err = new AuthFailedError('bad token');
    expect(err.context).toMatchObject({ reason: 'bad token' });
  });
});
