import { AlxError } from '@astralibx/core';

export class AlxTelegramInboxError extends AlxError {
  constructor(message: string, public readonly code: string) {
    super(message, code);
    this.name = 'AlxTelegramInboxError';
  }
}

export class ConfigValidationError extends AlxTelegramInboxError {
  constructor(message: string, public readonly field: string) {
    super(message, 'CONFIG_VALIDATION');
    this.name = 'ConfigValidationError';
  }
}

export class ConversationNotFoundError extends AlxTelegramInboxError {
  constructor(public readonly conversationId: string) {
    super(`Conversation not found: ${conversationId}`, 'CONVERSATION_NOT_FOUND');
    this.name = 'ConversationNotFoundError';
  }
}

export class MessageNotFoundError extends AlxTelegramInboxError {
  constructor(public readonly messageId: string) {
    super(`Message not found: ${messageId}`, 'MESSAGE_NOT_FOUND');
    this.name = 'MessageNotFoundError';
  }
}

export class MediaUploadError extends AlxTelegramInboxError {
  constructor(
    public readonly filename: string,
    public readonly originalError: Error,
  ) {
    super(`Media upload failed for ${filename}: ${originalError.message}`, 'MEDIA_UPLOAD_ERROR');
    this.name = 'MediaUploadError';
  }
}

export class SyncError extends AlxTelegramInboxError {
  constructor(
    public readonly accountId: string,
    public readonly originalError: Error,
  ) {
    super(`History sync failed for account ${accountId}: ${originalError.message}`, 'SYNC_ERROR');
    this.name = 'SyncError';
  }
}
