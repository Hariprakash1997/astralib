import { ChatSessionStatus } from '@astralibx/chat-types';
import { InvalidSessionStateError } from '../errors/index.js';

/**
 * Map of allowed transitions for each session status.
 * Key = current status, Value = set of statuses that can be transitioned to.
 */
const ALLOWED_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  [ChatSessionStatus.New]: new Set([
    ChatSessionStatus.Active,
    ChatSessionStatus.WaitingAgent,
    ChatSessionStatus.Resolved,
    ChatSessionStatus.Abandoned,
  ]),
  [ChatSessionStatus.Active]: new Set([
    ChatSessionStatus.WaitingAgent,
    ChatSessionStatus.WithAgent,
    ChatSessionStatus.Resolved,
    ChatSessionStatus.Abandoned,
  ]),
  [ChatSessionStatus.WaitingAgent]: new Set([
    ChatSessionStatus.Active,
    ChatSessionStatus.WithAgent,
    ChatSessionStatus.Resolved,
    ChatSessionStatus.Abandoned,
  ]),
  [ChatSessionStatus.WithAgent]: new Set([
    ChatSessionStatus.Active,
    ChatSessionStatus.WaitingAgent,
    ChatSessionStatus.Resolved,
    ChatSessionStatus.Abandoned,
  ]),
  [ChatSessionStatus.Resolved]: new Set([
    ChatSessionStatus.Active,
    ChatSessionStatus.Closed,
  ]),
  [ChatSessionStatus.Closed]: new Set<string>(),
  [ChatSessionStatus.Abandoned]: new Set([
    ChatSessionStatus.Active,
  ]),
};

/**
 * Validates that a session status transition is allowed.
 *
 * @param sessionId - The session identifier (used in error messages).
 * @param currentStatus - The current status of the session.
 * @param targetStatus - The desired target status.
 * @throws InvalidSessionStateError when the transition is not permitted.
 */
export function validateSessionTransition(
  sessionId: string,
  currentStatus: string,
  targetStatus: string,
): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (!allowed) {
    throw new InvalidSessionStateError(
      sessionId,
      currentStatus,
      `transition to "${targetStatus}" (unknown current status)`,
    );
  }

  if (!allowed.has(targetStatus)) {
    throw new InvalidSessionStateError(
      sessionId,
      currentStatus,
      `transition to "${targetStatus}"`,
    );
  }
}
