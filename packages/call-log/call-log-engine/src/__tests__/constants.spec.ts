import { describe, it, expect } from 'vitest';
import {
  ERROR_CODE,
  ERROR_MESSAGE,
  PIPELINE_DEFAULTS,
  CALL_LOG_DEFAULTS,
  AGENT_CALL_DEFAULTS,
  SYSTEM_TIMELINE,
  SYSTEM_TIMELINE_FN,
} from '../constants/index.js';

describe('ERROR_CODE', () => {
  it('all values have CALL_ prefix', () => {
    for (const value of Object.values(ERROR_CODE)) {
      expect(value).toMatch(/^CALL_/);
    }
  });

  it('has expected keys', () => {
    expect(ERROR_CODE.PipelineNotFound).toBe('CALL_PIPELINE_NOT_FOUND');
    expect(ERROR_CODE.InvalidPipeline).toBe('CALL_INVALID_PIPELINE');
    expect(ERROR_CODE.StageNotFound).toBe('CALL_STAGE_NOT_FOUND');
    expect(ERROR_CODE.StageInUse).toBe('CALL_STAGE_IN_USE');
    expect(ERROR_CODE.CallLogNotFound).toBe('CALL_LOG_NOT_FOUND');
    expect(ERROR_CODE.CallLogClosed).toBe('CALL_LOG_CLOSED');
    expect(ERROR_CODE.ContactNotFound).toBe('CALL_CONTACT_NOT_FOUND');
    expect(ERROR_CODE.AgentCapacityFull).toBe('CALL_AGENT_CAPACITY_FULL');
    expect(ERROR_CODE.InvalidConfig).toBe('CALL_INVALID_CONFIG');
    expect(ERROR_CODE.AuthFailed).toBe('CALL_AUTH_FAILED');
  });
});

describe('ERROR_MESSAGE', () => {
  it('all values are non-empty strings', () => {
    for (const value of Object.values(ERROR_MESSAGE)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe('PIPELINE_DEFAULTS', () => {
  it('MaxStages is 20', () => {
    expect(PIPELINE_DEFAULTS.MaxStages).toBe(20);
  });
});

describe('CALL_LOG_DEFAULTS', () => {
  it('MaxTimelineEntries is 200', () => {
    expect(CALL_LOG_DEFAULTS.MaxTimelineEntries).toBe(200);
  });

  it('DefaultFollowUpDays is 3', () => {
    expect(CALL_LOG_DEFAULTS.DefaultFollowUpDays).toBe(3);
  });

  it('TimelinePageSize is 20', () => {
    expect(CALL_LOG_DEFAULTS.TimelinePageSize).toBe(20);
  });
});

describe('AGENT_CALL_DEFAULTS', () => {
  it('MaxConcurrentCalls is 10', () => {
    expect(AGENT_CALL_DEFAULTS.MaxConcurrentCalls).toBe(10);
  });
});

describe('SYSTEM_TIMELINE', () => {
  it('all values are strings', () => {
    for (const value of Object.values(SYSTEM_TIMELINE)) {
      expect(typeof value).toBe('string');
    }
  });

  it('has expected messages', () => {
    expect(SYSTEM_TIMELINE.CallCreated).toBe('Call log created');
    expect(SYSTEM_TIMELINE.CallClosed).toBe('Call closed');
    expect(SYSTEM_TIMELINE.FollowUpCompleted).toBe('Follow-up completed');
  });
});

describe('SYSTEM_TIMELINE_FN', () => {
  it('stageChanged returns formatted string', () => {
    const result = SYSTEM_TIMELINE_FN.stageChanged('Open', 'Closed');
    expect(result).toBe('Stage changed from "Open" to "Closed"');
  });

  it('callAssigned returns formatted string', () => {
    const result = SYSTEM_TIMELINE_FN.callAssigned('Alice');
    expect(result).toBe('Call assigned to Alice');
  });

  it('callReassigned returns formatted string', () => {
    const result = SYSTEM_TIMELINE_FN.callReassigned('Alice', 'Bob');
    expect(result).toBe('Call reassigned from Alice to Bob');
  });

  it('followUpSet returns formatted string', () => {
    const result = SYSTEM_TIMELINE_FN.followUpSet('2026-04-01');
    expect(result).toBe('Follow-up scheduled for 2026-04-01');
  });
});
