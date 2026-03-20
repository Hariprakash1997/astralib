import { describe, it, expect } from 'vitest';
import { ChatSessionStatus } from '@astralibx/chat-types';
import { validateSessionTransition } from '../validation/state.validator';
import { InvalidSessionStateError } from '../errors';

describe('validateSessionTransition()', () => {
  const sessionId = 'sess-1';

  // ── Valid transitions ─────────────────────────────────────────────────

  describe('valid transitions', () => {
    const validCases: [ChatSessionStatus, ChatSessionStatus][] = [
      // New → various
      [ChatSessionStatus.New, ChatSessionStatus.Active],
      [ChatSessionStatus.New, ChatSessionStatus.WaitingAgent],
      [ChatSessionStatus.New, ChatSessionStatus.Resolved],
      [ChatSessionStatus.New, ChatSessionStatus.Abandoned],
      // Active → various
      [ChatSessionStatus.Active, ChatSessionStatus.WaitingAgent],
      [ChatSessionStatus.Active, ChatSessionStatus.WithAgent],
      [ChatSessionStatus.Active, ChatSessionStatus.Resolved],
      [ChatSessionStatus.Active, ChatSessionStatus.Abandoned],
      // WaitingAgent → various
      [ChatSessionStatus.WaitingAgent, ChatSessionStatus.Active],
      [ChatSessionStatus.WaitingAgent, ChatSessionStatus.WithAgent],
      [ChatSessionStatus.WaitingAgent, ChatSessionStatus.Resolved],
      [ChatSessionStatus.WaitingAgent, ChatSessionStatus.Abandoned],
      // WithAgent → various
      [ChatSessionStatus.WithAgent, ChatSessionStatus.Active],
      [ChatSessionStatus.WithAgent, ChatSessionStatus.WaitingAgent],
      [ChatSessionStatus.WithAgent, ChatSessionStatus.Resolved],
      [ChatSessionStatus.WithAgent, ChatSessionStatus.Abandoned],
      // Resolved → limited
      [ChatSessionStatus.Resolved, ChatSessionStatus.Active],
      [ChatSessionStatus.Resolved, ChatSessionStatus.Closed],
      // Abandoned → Active
      [ChatSessionStatus.Abandoned, ChatSessionStatus.Active],
    ];

    it.each(validCases)('should allow %s → %s', (from, to) => {
      expect(() => validateSessionTransition(sessionId, from, to)).not.toThrow();
    });
  });

  // ── Invalid transitions ───────────────────────────────────────────────

  describe('invalid transitions', () => {
    const invalidCases: [ChatSessionStatus, ChatSessionStatus][] = [
      // Closed is terminal — no transitions out
      [ChatSessionStatus.Closed, ChatSessionStatus.Active],
      [ChatSessionStatus.Closed, ChatSessionStatus.New],
      [ChatSessionStatus.Closed, ChatSessionStatus.Resolved],
      // Resolved cannot go to WaitingAgent directly
      [ChatSessionStatus.Resolved, ChatSessionStatus.WaitingAgent],
      [ChatSessionStatus.Resolved, ChatSessionStatus.WithAgent],
      // Abandoned can only reopen to Active
      [ChatSessionStatus.Abandoned, ChatSessionStatus.Resolved],
      [ChatSessionStatus.Abandoned, ChatSessionStatus.WaitingAgent],
      // New cannot go directly to Closed or WithAgent
      [ChatSessionStatus.New, ChatSessionStatus.Closed],
      [ChatSessionStatus.New, ChatSessionStatus.WithAgent],
    ];

    it.each(invalidCases)('should reject %s → %s', (from, to) => {
      expect(() => validateSessionTransition(sessionId, from, to)).toThrow(InvalidSessionStateError);
    });
  });

  // ── Error details ─────────────────────────────────────────────────────

  it('should include session ID and current status in error', () => {
    try {
      validateSessionTransition(sessionId, ChatSessionStatus.Closed, ChatSessionStatus.Active);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(InvalidSessionStateError);
      expect(err.sessionId).toBe(sessionId);
      expect(err.currentStatus).toBe(ChatSessionStatus.Closed);
    }
  });

  it('should throw for unknown current status', () => {
    expect(() =>
      validateSessionTransition(sessionId, 'bogus_status' as any, ChatSessionStatus.Active),
    ).toThrow(InvalidSessionStateError);
  });
});
