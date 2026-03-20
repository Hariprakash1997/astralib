import { describe, it, expect } from 'vitest';
import { validateEscalation } from '../validation/escalation.validator';
import { EscalationError } from '../errors';
import { AGENT_LEVEL } from '../constants';
import { AgentStatus } from '@astralibx/chat-types';

function createMockAgent(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => 'agent-1' },
    name: 'Agent',
    isActive: true,
    isOnline: true,
    status: AgentStatus.Available,
    level: AGENT_LEVEL.L1,
    parentId: null,
    teamId: null,
    ...overrides,
  } as any;
}

describe('validateEscalation()', () => {
  const sessionId = 'sess-1';

  it('should accept valid L1→L2 escalation within the same team', () => {
    const current = createMockAgent({ level: AGENT_LEVEL.L1, teamId: 'team-1' });
    const target = createMockAgent({
      _id: { toString: () => 'agent-2' },
      level: AGENT_LEVEL.L2,
      teamId: 'team-1',
    });

    expect(() => validateEscalation(sessionId, current, target)).not.toThrow();
  });

  it('should accept valid L1→L2 escalation to direct supervisor', () => {
    const current = createMockAgent({
      level: AGENT_LEVEL.L1,
      parentId: { toString: () => 'mgr-1' },
    });
    const target = createMockAgent({
      _id: { toString: () => 'mgr-1' },
      level: AGENT_LEVEL.L2,
    });

    expect(() => validateEscalation(sessionId, current, target)).not.toThrow();
  });

  it('should reject escalation skipping levels (L1→L3)', () => {
    const current = createMockAgent({ level: AGENT_LEVEL.L1, teamId: 'team-1' });
    const target = createMockAgent({
      _id: { toString: () => 'agent-2' },
      level: AGENT_LEVEL.L3,
      teamId: 'team-1',
    });

    expect(() => validateEscalation(sessionId, current, target)).toThrow(EscalationError);
  });

  it('should reject escalation to lower level (L2→L1)', () => {
    const current = createMockAgent({ level: AGENT_LEVEL.L2, teamId: 'team-1' });
    const target = createMockAgent({
      _id: { toString: () => 'agent-2' },
      level: AGENT_LEVEL.L1,
      teamId: 'team-1',
    });

    expect(() => validateEscalation(sessionId, current, target)).toThrow(EscalationError);
  });

  it('should reject escalation to same level', () => {
    const current = createMockAgent({ level: AGENT_LEVEL.L1, teamId: 'team-1' });
    const target = createMockAgent({
      _id: { toString: () => 'agent-2' },
      level: AGENT_LEVEL.L1,
      teamId: 'team-1',
    });

    expect(() => validateEscalation(sessionId, current, target)).toThrow(EscalationError);
  });

  it('should reject escalation to agent not in same team and not direct supervisor', () => {
    const current = createMockAgent({ level: AGENT_LEVEL.L1, teamId: 'team-1', parentId: null });
    const target = createMockAgent({
      _id: { toString: () => 'agent-2' },
      level: AGENT_LEVEL.L2,
      teamId: 'team-2', // different team
    });

    expect(() => validateEscalation(sessionId, current, target)).toThrow(EscalationError);
  });

  it('should reject escalation when target is offline', () => {
    const current = createMockAgent({ level: AGENT_LEVEL.L1, teamId: 'team-1' });
    const target = createMockAgent({
      _id: { toString: () => 'agent-2' },
      level: AGENT_LEVEL.L2,
      teamId: 'team-1',
      isOnline: false,
    });

    expect(() => validateEscalation(sessionId, current, target)).toThrow(EscalationError);
  });

  it('should reject escalation when target is inactive', () => {
    const current = createMockAgent({ level: AGENT_LEVEL.L1, teamId: 'team-1' });
    const target = createMockAgent({
      _id: { toString: () => 'agent-2' },
      level: AGENT_LEVEL.L2,
      teamId: 'team-1',
      isActive: false,
    });

    expect(() => validateEscalation(sessionId, current, target)).toThrow(EscalationError);
  });

  it('should include session ID in error context', () => {
    const current = createMockAgent({ level: AGENT_LEVEL.L1, teamId: 'team-1' });
    const target = createMockAgent({
      _id: { toString: () => 'agent-2' },
      level: AGENT_LEVEL.L3, // skip
      teamId: 'team-1',
    });

    try {
      validateEscalation(sessionId, current, target);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(EscalationError);
      expect(err.sessionId).toBe(sessionId);
    }
  });
});
