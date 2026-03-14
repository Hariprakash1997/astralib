import { describe, it, expect } from 'vitest';
import { AlxError, ConfigValidationError } from '../errors';

describe('AlxError', () => {
  it('should set message, code, and name', () => {
    const err = new AlxError('something broke', 'SOME_CODE');
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('SOME_CODE');
    expect(err.name).toBe('AlxError');
  });

  it('should be an instance of Error', () => {
    const err = new AlxError('test', 'TEST');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AlxError);
  });

  it('should have a stack trace', () => {
    const err = new AlxError('test', 'TEST');
    expect(err.stack).toBeDefined();
  });
});

describe('ConfigValidationError', () => {
  it('should set field and use CONFIG_VALIDATION_ERROR code', () => {
    const err = new ConfigValidationError('bad field', 'db.connection');
    expect(err.message).toBe('bad field');
    expect(err.code).toBe('CONFIG_VALIDATION_ERROR');
    expect(err.field).toBe('db.connection');
    expect(err.name).toBe('ConfigValidationError');
  });

  it('should extend AlxError', () => {
    const err = new ConfigValidationError('test', 'field');
    expect(err).toBeInstanceOf(AlxError);
    expect(err).toBeInstanceOf(Error);
  });
});
