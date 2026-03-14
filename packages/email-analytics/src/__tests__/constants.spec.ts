import { describe, it, expect } from 'vitest';
import { EVENT_TYPE, AGGREGATION_INTERVAL, STATS_GROUP_BY } from '../constants';

describe('EVENT_TYPE', () => {
  it('should have all expected event types', () => {
    expect(EVENT_TYPE.Sent).toBe('sent');
    expect(EVENT_TYPE.Delivered).toBe('delivered');
    expect(EVENT_TYPE.Bounced).toBe('bounced');
    expect(EVENT_TYPE.Complained).toBe('complained');
    expect(EVENT_TYPE.Opened).toBe('opened');
    expect(EVENT_TYPE.Clicked).toBe('clicked');
    expect(EVENT_TYPE.Unsubscribed).toBe('unsubscribed');
    expect(EVENT_TYPE.Failed).toBe('failed');
  });

  it('should have exactly 8 event types', () => {
    expect(Object.keys(EVENT_TYPE)).toHaveLength(8);
  });

  it('should have unique values', () => {
    const values = Object.values(EVENT_TYPE);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('should have string values for all keys', () => {
    for (const value of Object.values(EVENT_TYPE)) {
      expect(typeof value).toBe('string');
    }
  });
});

describe('AGGREGATION_INTERVAL', () => {
  it('should have all expected intervals', () => {
    expect(AGGREGATION_INTERVAL.Daily).toBe('daily');
    expect(AGGREGATION_INTERVAL.Weekly).toBe('weekly');
    expect(AGGREGATION_INTERVAL.Monthly).toBe('monthly');
  });

  it('should have exactly 3 intervals', () => {
    expect(Object.keys(AGGREGATION_INTERVAL)).toHaveLength(3);
  });

  it('should have unique values', () => {
    const values = Object.values(AGGREGATION_INTERVAL);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('STATS_GROUP_BY', () => {
  it('should have all expected group-by options', () => {
    expect(STATS_GROUP_BY.Account).toBe('account');
    expect(STATS_GROUP_BY.Rule).toBe('rule');
    expect(STATS_GROUP_BY.Template).toBe('template');
  });

  it('should have exactly 3 group-by options', () => {
    expect(Object.keys(STATS_GROUP_BY)).toHaveLength(3);
  });

  it('should have unique values', () => {
    const values = Object.values(STATS_GROUP_BY);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
