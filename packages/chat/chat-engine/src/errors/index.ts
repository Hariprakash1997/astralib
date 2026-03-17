import { AlxError } from '@astralibx/core';

export class ChatEngineError extends AlxError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'ChatEngineError';
  }
}

export class SessionNotFoundError extends ChatEngineError {
  constructor(public readonly sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    this.name = 'SessionNotFoundError';
  }
}

export class AgentNotFoundError extends ChatEngineError {
  constructor(public readonly agentId: string) {
    super(`Agent not found: ${agentId}`, 'AGENT_NOT_FOUND');
    this.name = 'AgentNotFoundError';
  }
}

export class RateLimitError extends ChatEngineError {
  constructor(public readonly sessionId: string) {
    super(`Rate limit exceeded for session: ${sessionId}`, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class InvalidConfigError extends ChatEngineError {
  constructor(message: string, public readonly field: string) {
    super(message, 'INVALID_CONFIG');
    this.name = 'InvalidConfigError';
  }
}
