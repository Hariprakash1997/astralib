import { describe, it, expect } from 'vitest';
import { CallLogSettingsSchema } from '../../schemas/call-log-settings.schema.js';
import { CallPriority } from '@astralibx/call-log-types';
import { CALL_LOG_DEFAULTS, AGENT_CALL_DEFAULTS } from '../../constants/index.js';

describe('CallLogSettingsSchema', () => {
  it('key defaults to "global"', () => {
    const path = CallLogSettingsSchema.path('key') as any;
    expect(path.isRequired).toBe(true);
    expect(path.defaultValue).toBe('global');
  });

  it('availableTags defaults to empty array', () => {
    const path = CallLogSettingsSchema.path('availableTags') as any;
    const defaultVal = path.defaultValue?.();
    expect(Array.isArray(defaultVal)).toBe(true);
    expect(defaultVal.length).toBe(0);
  });

  it('availableCategories defaults to empty array', () => {
    const path = CallLogSettingsSchema.path('availableCategories') as any;
    const defaultVal = path.defaultValue?.();
    expect(Array.isArray(defaultVal)).toBe(true);
    expect(defaultVal.length).toBe(0);
  });

  it('defaultFollowUpDays defaults to 3', () => {
    const path = CallLogSettingsSchema.path('defaultFollowUpDays') as any;
    expect(path.defaultValue).toBe(CALL_LOG_DEFAULTS.DefaultFollowUpDays);
    expect(path.defaultValue).toBe(3);
  });

  it('followUpReminderEnabled defaults to true', () => {
    const path = CallLogSettingsSchema.path('followUpReminderEnabled') as any;
    expect(path.defaultValue).toBe(true);
  });

  it('timelinePageSize defaults to 20', () => {
    const path = CallLogSettingsSchema.path('timelinePageSize') as any;
    expect(path.defaultValue).toBe(CALL_LOG_DEFAULTS.TimelinePageSize);
    expect(path.defaultValue).toBe(20);
  });

  it('maxConcurrentCalls defaults to 10', () => {
    const path = CallLogSettingsSchema.path('maxConcurrentCalls') as any;
    expect(path.defaultValue).toBe(AGENT_CALL_DEFAULTS.MaxConcurrentCalls);
    expect(path.defaultValue).toBe(10);
  });

  it('tenantId is optional', () => {
    const path = CallLogSettingsSchema.path('tenantId') as any;
    expect(path.isRequired).toBeFalsy();
  });

  it('priorityLevels defaults to an array of 4 entries', () => {
    const path = CallLogSettingsSchema.path('priorityLevels') as any;
    const defaultVal = path.defaultValue?.();
    expect(Array.isArray(defaultVal)).toBe(true);
    expect(defaultVal.length).toBe(4);
  });

  it('priorityLevels default includes all 4 CallPriority values', () => {
    const path = CallLogSettingsSchema.path('priorityLevels') as any;
    const defaultVal: Array<{ value: string }> = path.defaultValue?.();
    const values = defaultVal.map((p) => p.value);
    expect(values).toContain(CallPriority.Low);
    expect(values).toContain(CallPriority.Medium);
    expect(values).toContain(CallPriority.High);
    expect(values).toContain(CallPriority.Urgent);
  });

  it('each priorityLevel has label, color, and order', () => {
    const path = CallLogSettingsSchema.path('priorityLevels') as any;
    const defaultVal: Array<{ value: string; label: string; color: string; order: number }> =
      path.defaultValue?.();
    for (const p of defaultVal) {
      expect(typeof p.label).toBe('string');
      expect(typeof p.color).toBe('string');
      expect(typeof p.order).toBe('number');
    }
  });

  it('has timestamps option', () => {
    expect((CallLogSettingsSchema as any).options.timestamps).toBe(true);
  });
});
