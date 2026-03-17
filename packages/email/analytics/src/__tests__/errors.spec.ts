import { describe, it, expect } from 'vitest';
import { AlxAnalyticsError, InvalidDateRangeError, AggregationError } from '../errors';
import { AlxError } from '@astralibx/core';

describe('AlxAnalyticsError', () => {
  it('should create with message and code', () => {
    const err = new AlxAnalyticsError('something failed', 'TEST_CODE');
    expect(err.message).toBe('something failed');
    expect(err.code).toBe('TEST_CODE');
    expect(err.name).toBe('AlxAnalyticsError');
  });

  it('should be instanceof Error', () => {
    const err = new AlxAnalyticsError('test', 'CODE');
    expect(err).toBeInstanceOf(Error);
  });

  it('should be instanceof AlxError', () => {
    const err = new AlxAnalyticsError('test', 'CODE');
    expect(err).toBeInstanceOf(AlxError);
  });

  it('should have a stack trace', () => {
    const err = new AlxAnalyticsError('test', 'CODE');
    expect(err.stack).toBeDefined();
  });
});

describe('InvalidDateRangeError', () => {
  it('should format message with start and end dates', () => {
    const err = new InvalidDateRangeError('2024-01-15', '2024-01-10');
    expect(err.message).toBe('Invalid date range: 2024-01-15 to 2024-01-10');
  });

  it('should have INVALID_DATE_RANGE code', () => {
    const err = new InvalidDateRangeError('2024-01-15', '2024-01-10');
    expect(err.code).toBe('INVALID_DATE_RANGE');
  });

  it('should store startDate and endDate', () => {
    const err = new InvalidDateRangeError('2024-01-15', '2024-01-10');
    expect(err.startDate).toBe('2024-01-15');
    expect(err.endDate).toBe('2024-01-10');
  });

  it('should have correct name', () => {
    const err = new InvalidDateRangeError('2024-01-15', '2024-01-10');
    expect(err.name).toBe('InvalidDateRangeError');
  });

  it('should be instanceof AlxAnalyticsError', () => {
    const err = new InvalidDateRangeError('2024-01-15', '2024-01-10');
    expect(err).toBeInstanceOf(AlxAnalyticsError);
  });

  it('should be instanceof AlxError', () => {
    const err = new InvalidDateRangeError('2024-01-15', '2024-01-10');
    expect(err).toBeInstanceOf(AlxError);
  });

  it('should be instanceof Error', () => {
    const err = new InvalidDateRangeError('2024-01-15', '2024-01-10');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('AggregationError', () => {
  it('should format message with pipeline name and original error', () => {
    const original = new Error('connection lost');
    const err = new AggregationError('byAccount', original);
    expect(err.message).toBe('Aggregation pipeline failed (byAccount): connection lost');
  });

  it('should have AGGREGATION_FAILED code', () => {
    const original = new Error('timeout');
    const err = new AggregationError('byRule', original);
    expect(err.code).toBe('AGGREGATION_FAILED');
  });

  it('should store pipeline and originalError', () => {
    const original = new Error('db error');
    const err = new AggregationError('byTemplate', original);
    expect(err.pipeline).toBe('byTemplate');
    expect(err.originalError).toBe(original);
  });

  it('should have correct name', () => {
    const err = new AggregationError('test', new Error('x'));
    expect(err.name).toBe('AggregationError');
  });

  it('should be instanceof AlxAnalyticsError', () => {
    const err = new AggregationError('test', new Error('x'));
    expect(err).toBeInstanceOf(AlxAnalyticsError);
  });

  it('should be instanceof AlxError', () => {
    const err = new AggregationError('test', new Error('x'));
    expect(err).toBeInstanceOf(AlxError);
  });

  it('should be instanceof Error', () => {
    const err = new AggregationError('test', new Error('x'));
    expect(err).toBeInstanceOf(Error);
  });
});
