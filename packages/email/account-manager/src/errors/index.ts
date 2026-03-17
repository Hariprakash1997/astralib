import { AlxError } from '@astralibx/core';

export class AlxAccountError extends AlxError {
  constructor(message: string, public readonly code: string) {
    super(message, code);
    this.name = 'AlxAccountError';
  }
}

export class ConfigValidationError extends AlxAccountError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION');
    this.name = 'ConfigValidationError';
  }
}

export class AccountDisabledError extends AlxAccountError {
  constructor(
    public readonly accountId: string,
    public readonly reason: string,
  ) {
    super(`Account ${accountId} is disabled: ${reason}`, 'ACCOUNT_DISABLED');
    this.name = 'AccountDisabledError';
  }
}

export class NoAvailableAccountError extends AlxAccountError {
  constructor() {
    super('No available accounts with remaining capacity', 'NO_AVAILABLE_ACCOUNT');
    this.name = 'NoAvailableAccountError';
  }
}

export class SmtpConnectionError extends AlxAccountError {
  constructor(
    public readonly accountId: string,
    public readonly originalError: Error,
  ) {
    super(`SMTP connection failed for account ${accountId}: ${originalError.message}`, 'SMTP_CONNECTION');
    this.name = 'SmtpConnectionError';
  }
}

export class InvalidTokenError extends AlxAccountError {
  constructor(public readonly tokenType: 'unsubscribe') {
    super(`Invalid or expired ${tokenType} token`, 'INVALID_TOKEN');
    this.name = 'InvalidTokenError';
  }
}

export class QuotaExceededError extends AlxAccountError {
  constructor(
    public readonly accountId: string,
    public readonly dailyMax: number,
    public readonly currentSent: number,
  ) {
    super(
      `Account ${accountId} exceeded daily quota: ${currentSent}/${dailyMax}`,
      'QUOTA_EXCEEDED',
    );
    this.name = 'QuotaExceededError';
  }
}

export class SnsSignatureError extends AlxAccountError {
  constructor() {
    super('SNS message signature verification failed', 'SNS_SIGNATURE_INVALID');
    this.name = 'SnsSignatureError';
  }
}

export class AccountNotFoundError extends AlxAccountError {
  constructor(public readonly accountId: string) {
    super(`Account not found: ${accountId}`, 'ACCOUNT_NOT_FOUND');
    this.name = 'AccountNotFoundError';
  }
}

export class DraftNotFoundError extends AlxAccountError {
  constructor(public readonly draftId: string) {
    super(`Draft not found: ${draftId}`, 'DRAFT_NOT_FOUND');
    this.name = 'DraftNotFoundError';
  }
}
