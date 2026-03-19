import type { ResolvedOptions } from '../types/config.types.js';
import type { ChatSessionDocument } from '../schemas/chat-session.schema.js';
import { ChatSessionStatus } from '@astralibx/chat-types';
import { MessageValidationError, InvalidSessionStateError } from '../errors/index.js';

/**
 * Validates and trims message content. Throws MessageValidationError if
 * the content is empty, whitespace-only, or exceeds the configured max length.
 */
export function validateMessageContent(content: string, options: ResolvedOptions): string {
  if (!content || typeof content !== 'string') {
    throw new MessageValidationError('content', 'Message content is required');
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new MessageValidationError('content', 'Message content cannot be empty');
  }

  if (trimmed.length > options.maxMessageLength) {
    throw new MessageValidationError('content', `Message exceeds maximum length of ${options.maxMessageLength} characters`);
  }

  return trimmed;
}

/**
 * Validates that a session is in a state where messages can be sent.
 * Throws InvalidSessionStateError for resolved or abandoned sessions.
 */
export function validateSessionForMessaging(session: ChatSessionDocument): void {
  const invalidStatuses = [ChatSessionStatus.Resolved, ChatSessionStatus.Abandoned];
  if (invalidStatuses.includes(session.status)) {
    throw new InvalidSessionStateError(
      session.sessionId,
      session.status,
      'send message',
    );
  }
}

/**
 * Validates that the connected agent owns the session. Throws
 * InvalidSessionStateError when the session is assigned to a different agent.
 */
export function validateAgentOwnership(session: any, connectedAgentId: string): void {
  if (session.agentId && session.agentId.toString() !== connectedAgentId) {
    throw new InvalidSessionStateError(
      session.sessionId ?? 'unknown',
      'assigned',
      'agent ownership check',
    );
  }
}
