import { describe, it, expect } from 'vitest';
import {
  AlxTelegramInboxError,
  ConfigValidationError,
  ConversationNotFoundError,
  MessageNotFoundError,
  MediaUploadError,
  SyncError,
} from '../errors';

describe('Error Classes', () => {
  describe('AlxTelegramInboxError', () => {
    it('creates with message and code', () => {
      const err = new AlxTelegramInboxError('something broke', 'CUSTOM_CODE');
      expect(err.message).toBe('something broke');
      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.name).toBe('AlxTelegramInboxError');
    });

    it('is instanceof Error', () => {
      const err = new AlxTelegramInboxError('test', 'TEST');
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new AlxTelegramInboxError('test', 'TEST');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('AlxTelegramInboxError');
    });
  });

  describe('ConfigValidationError', () => {
    it('has correct code and field', () => {
      const err = new ConfigValidationError('bad config', 'db.connection');
      expect(err.code).toBe('CONFIG_VALIDATION');
      expect(err.field).toBe('db.connection');
      expect(err.name).toBe('ConfigValidationError');
      expect(err.message).toBe('bad config');
    });

    it('is instanceof AlxTelegramInboxError and Error', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err).toBeInstanceOf(AlxTelegramInboxError);
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err.stack).toBeDefined();
    });
  });

  describe('ConversationNotFoundError', () => {
    it('has correct code and conversationId', () => {
      const err = new ConversationNotFoundError('conv-999');
      expect(err.code).toBe('CONVERSATION_NOT_FOUND');
      expect(err.conversationId).toBe('conv-999');
      expect(err.name).toBe('ConversationNotFoundError');
      expect(err.message).toBe('Conversation not found: conv-999');
    });

    it('is instanceof AlxTelegramInboxError and Error', () => {
      const err = new ConversationNotFoundError('x');
      expect(err).toBeInstanceOf(AlxTelegramInboxError);
      expect(err).toBeInstanceOf(Error);
    });

    it('formats message with conversationId', () => {
      const err = new ConversationNotFoundError('my-conversation');
      expect(err.message).toContain('my-conversation');
    });
  });

  describe('MessageNotFoundError', () => {
    it('has correct code and messageId', () => {
      const err = new MessageNotFoundError('msg-456');
      expect(err.code).toBe('MESSAGE_NOT_FOUND');
      expect(err.messageId).toBe('msg-456');
      expect(err.name).toBe('MessageNotFoundError');
      expect(err.message).toBe('Message not found: msg-456');
    });

    it('is instanceof AlxTelegramInboxError and Error', () => {
      const err = new MessageNotFoundError('x');
      expect(err).toBeInstanceOf(AlxTelegramInboxError);
      expect(err).toBeInstanceOf(Error);
    });

    it('formats message with messageId', () => {
      const err = new MessageNotFoundError('my-message');
      expect(err.message).toContain('my-message');
    });
  });

  describe('MediaUploadError', () => {
    it('has correct code, filename, and originalError', () => {
      const original = new Error('upload timeout');
      const err = new MediaUploadError('photo.jpg', original);
      expect(err.code).toBe('MEDIA_UPLOAD_ERROR');
      expect(err.filename).toBe('photo.jpg');
      expect(err.originalError).toBe(original);
      expect(err.name).toBe('MediaUploadError');
      expect(err.message).toBe('Media upload failed for photo.jpg: upload timeout');
    });

    it('is instanceof AlxTelegramInboxError and Error', () => {
      const err = new MediaUploadError('file.pdf', new Error('fail'));
      expect(err).toBeInstanceOf(AlxTelegramInboxError);
      expect(err).toBeInstanceOf(Error);
    });

    it('preserves original error reference', () => {
      const original = new Error('disk full');
      const err = new MediaUploadError('file.txt', original);
      expect(err.originalError).toBe(original);
      expect(err.originalError.message).toBe('disk full');
    });
  });

  describe('SyncError', () => {
    it('has correct code, accountId, and originalError', () => {
      const original = new Error('ECONNREFUSED');
      const err = new SyncError('acc-123', original);
      expect(err.code).toBe('SYNC_ERROR');
      expect(err.accountId).toBe('acc-123');
      expect(err.originalError).toBe(original);
      expect(err.name).toBe('SyncError');
      expect(err.message).toBe('History sync failed for account acc-123: ECONNREFUSED');
    });

    it('is instanceof AlxTelegramInboxError and Error', () => {
      const err = new SyncError('acc-1', new Error('fail'));
      expect(err).toBeInstanceOf(AlxTelegramInboxError);
      expect(err).toBeInstanceOf(Error);
    });

    it('formats message with accountId and original error message', () => {
      const err = new SyncError('my-account', new Error('network down'));
      expect(err.message).toContain('my-account');
      expect(err.message).toContain('network down');
    });
  });
});
