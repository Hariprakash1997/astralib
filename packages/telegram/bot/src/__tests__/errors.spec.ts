import { describe, it, expect } from 'vitest';
import {
  BotNotRunningError,
  BotAlreadyRunningError,
  ConfigValidationError,
  CommandNotFoundError,
} from '../errors';

describe('Error Classes', () => {
  describe('BotNotRunningError', () => {
    it('creates with correct message', () => {
      const err = new BotNotRunningError();
      expect(err.message).toBe('Bot is not running. Call start() first.');
      expect(err.name).toBe('BotNotRunningError');
    });

    it('is instanceof Error', () => {
      const err = new BotNotRunningError();
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new BotNotRunningError();
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('BotNotRunningError');
    });
  });

  describe('BotAlreadyRunningError', () => {
    it('creates with correct message', () => {
      const err = new BotAlreadyRunningError();
      expect(err.message).toBe('Bot is already running. Call stop() first.');
      expect(err.name).toBe('BotAlreadyRunningError');
    });

    it('is instanceof Error', () => {
      const err = new BotAlreadyRunningError();
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new BotAlreadyRunningError();
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('BotAlreadyRunningError');
    });
  });

  describe('ConfigValidationError', () => {
    it('creates with message and field', () => {
      const err = new ConfigValidationError('bad config', 'token');
      expect(err.message).toBe('bad config');
      expect(err.name).toBe('ConfigValidationError');
      expect(err.field).toBe('token');
    });

    it('is instanceof Error', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new ConfigValidationError('msg', 'field');
      expect(err.stack).toBeDefined();
    });

    it('stores the field property', () => {
      const err = new ConfigValidationError('msg', 'db.connection');
      expect(err.field).toBe('db.connection');
    });
  });

  describe('CommandNotFoundError', () => {
    it('creates with command name in message', () => {
      const err = new CommandNotFoundError('start');
      expect(err.message).toBe('Command not found: start');
      expect(err.name).toBe('CommandNotFoundError');
    });

    it('is instanceof Error', () => {
      const err = new CommandNotFoundError('help');
      expect(err).toBeInstanceOf(Error);
    });

    it('captures stack trace', () => {
      const err = new CommandNotFoundError('test');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('CommandNotFoundError');
    });

    it('formats message with command name', () => {
      const err = new CommandNotFoundError('mycommand');
      expect(err.message).toContain('mycommand');
    });
  });
});
