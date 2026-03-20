import { AlxError } from '@astralibx/core';

// ── Base ────────────────────────────────────────────────────────────────────

export class AlxChatError extends AlxError {
  constructor(message: string, code: string, public readonly context?: Record<string, unknown>) {
    super(message, code);
    this.name = 'AlxChatError';
  }
}

/** @deprecated Use AlxChatError instead */
export const ChatEngineError = AlxChatError;

// ── Domain errors ───────────────────────────────────────────────────────────

export class SessionNotFoundError extends AlxChatError {
  constructor(public readonly sessionId: string) {
    super(`Session not found: ${sessionId}`, 'CHAT_SESSION_NOT_FOUND', { sessionId });
    this.name = 'SessionNotFoundError';
  }
}

export class AgentNotFoundError extends AlxChatError {
  constructor(public readonly agentId: string) {
    super(`Agent not found: ${agentId}`, 'CHAT_AGENT_NOT_FOUND', { agentId });
    this.name = 'AgentNotFoundError';
  }
}

export class InvalidSessionStateError extends AlxChatError {
  constructor(
    public readonly sessionId: string,
    public readonly currentStatus: string,
    public readonly attemptedAction: string,
  ) {
    super(
      `Cannot ${attemptedAction} on session ${sessionId} in status "${currentStatus}"`,
      'CHAT_INVALID_SESSION_STATE',
      { sessionId, currentStatus, attemptedAction },
    );
    this.name = 'InvalidSessionStateError';
  }
}

export class MessageValidationError extends AlxChatError {
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`Message validation failed on "${field}": ${reason}`, 'CHAT_MESSAGE_VALIDATION', {
      field,
      reason,
    });
    this.name = 'MessageValidationError';
  }
}

export class AgentCapacityError extends AlxChatError {
  constructor(
    public readonly agentId: string,
    public readonly currentLoad: number,
    public readonly maxCapacity: number,
  ) {
    super(
      `Agent ${agentId} at capacity (${currentLoad}/${maxCapacity})`,
      'CHAT_AGENT_CAPACITY',
      { agentId, currentLoad, maxCapacity },
    );
    this.name = 'AgentCapacityError';
  }
}

export class SessionExpiredError extends AlxChatError {
  constructor(public readonly sessionId: string) {
    super(`Session expired: ${sessionId}`, 'CHAT_SESSION_EXPIRED', { sessionId });
    this.name = 'SessionExpiredError';
  }
}

export class TransferError extends AlxChatError {
  constructor(
    public readonly sessionId: string,
    public readonly fromAgentId: string,
    public readonly toAgentId: string,
    public readonly reason: string,
  ) {
    super(
      `Transfer failed for session ${sessionId}: ${reason}`,
      'CHAT_TRANSFER_ERROR',
      { sessionId, fromAgentId, toAgentId, reason },
    );
    this.name = 'TransferError';
  }
}

export class EscalationError extends AlxChatError {
  constructor(
    public readonly sessionId: string,
    public readonly agentId: string,
    public readonly currentLevel: string,
    public readonly reason: string,
  ) {
    super(
      `Escalation failed for session ${sessionId}: ${reason}`,
      'CHAT_ESCALATION_ERROR',
      { sessionId, agentId, currentLevel, reason },
    );
    this.name = 'EscalationError';
  }
}

export class RateLimitError extends AlxChatError {
  resetIn?: number;

  constructor(public readonly identifier: string) {
    super(`Rate limit exceeded: ${identifier}`, 'CHAT_RATE_LIMIT_EXCEEDED', { identifier });
    this.name = 'RateLimitError';
  }
}

export class InvalidHierarchyError extends AlxChatError {
  constructor(public readonly reason: string) {
    super(`Invalid hierarchy: ${reason}`, 'CHAT_INVALID_HIERARCHY', { reason });
    this.name = 'InvalidHierarchyError';
  }
}

export class WebhookNotFoundError extends AlxChatError {
  constructor(public readonly webhookId: string) {
    super(`Webhook not found: ${webhookId}`, 'CHAT_WEBHOOK_NOT_FOUND', { webhookId });
    this.name = 'WebhookNotFoundError';
  }
}

export class InvalidConfigError extends AlxChatError {
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`Invalid config for "${field}": ${reason}`, 'CHAT_INVALID_CONFIG', { field, reason });
    this.name = 'InvalidConfigError';
  }
}
