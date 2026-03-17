import { AlxError } from '@astralibx/core';

export class AlxTelegramAccountError extends AlxError {
  constructor(message: string, public readonly code: string) {
    super(message, code);
    this.name = 'AlxTelegramAccountError';
  }
}

export class ConfigValidationError extends AlxTelegramAccountError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION');
    this.name = 'ConfigValidationError';
  }
}

export class ConnectionError extends AlxTelegramAccountError {
  constructor(
    public readonly accountId: string,
    public readonly originalError: Error,
  ) {
    super(`Telegram connection failed for account ${accountId}: ${originalError.message}`, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class AccountNotFoundError extends AlxTelegramAccountError {
  constructor(public readonly accountId: string) {
    super(`Account not found: ${accountId}`, 'ACCOUNT_NOT_FOUND');
    this.name = 'AccountNotFoundError';
  }
}

export class AccountBannedError extends AlxTelegramAccountError {
  constructor(
    public readonly accountId: string,
    public readonly errorCode: string,
  ) {
    super(`Account ${accountId} is banned: ${errorCode}`, 'ACCOUNT_BANNED');
    this.name = 'AccountBannedError';
  }
}

export class QuarantineError extends AlxTelegramAccountError {
  constructor(
    public readonly accountId: string,
    public readonly reason: string,
    public readonly until: Date,
  ) {
    super(`Account ${accountId} is quarantined until ${until.toISOString()}: ${reason}`, 'QUARANTINE');
    this.name = 'QuarantineError';
  }
}

export function normalizeErrorCode(error: unknown): { code: string; floodWaitSeconds?: number } {
  if (error == null) return { code: 'UNKNOWN_ERROR' };

  const err = error as Record<string, unknown>;

  // GramJS RPCError: has .errorMessage property
  if (typeof err.errorMessage === 'string') {
    const code = err.errorMessage.toUpperCase().trim();

    if (code.startsWith('FLOOD_WAIT')) {
      const seconds = typeof err.seconds === 'number' ? err.seconds : undefined;
      return { code: 'FLOOD_WAIT', floodWaitSeconds: seconds };
    }

    if (code.startsWith('SLOWMODE_WAIT')) {
      const seconds = typeof err.seconds === 'number' ? err.seconds : undefined;
      return { code: 'SLOWMODE_WAIT', floodWaitSeconds: seconds };
    }

    return { code };
  }

  // Error with .code property
  if (typeof err.code === 'string') {
    return { code: err.code.toUpperCase().trim() };
  }

  // Standard Error: extract from message as last resort
  if (error instanceof Error) {
    const match = error.message.match(/([A-Z][A-Z_]+(?:_\d+)?)/);
    if (match) {
      const code = match[1];
      if (code.startsWith('FLOOD_WAIT')) {
        const secondsMatch = error.message.match(/(\d+)\s*(?:seconds?|sec|s)?/i);
        return { code: 'FLOOD_WAIT', floodWaitSeconds: secondsMatch ? parseInt(secondsMatch[1], 10) : undefined };
      }
      return { code };
    }
    return { code: 'UNKNOWN_ERROR' };
  }

  return { code: 'UNKNOWN_ERROR' };
}
