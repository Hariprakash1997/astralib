import { describe, it, expect } from 'vitest';
import { CallDirection, CallPriority, TimelineEntryType } from '../enums';

describe('CallDirection', () => {
  it('should have inbound and outbound values', () => {
    expect(CallDirection.Inbound).toBe('inbound');
    expect(CallDirection.Outbound).toBe('outbound');
  });

  it('should have exactly 2 members', () => {
    const values = Object.values(CallDirection);
    expect(values).toHaveLength(2);
  });
});

describe('CallPriority', () => {
  it('should have all priority levels', () => {
    expect(CallPriority.Low).toBe('low');
    expect(CallPriority.Medium).toBe('medium');
    expect(CallPriority.High).toBe('high');
    expect(CallPriority.Urgent).toBe('urgent');
  });

  it('should have exactly 4 members', () => {
    const values = Object.values(CallPriority);
    expect(values).toHaveLength(4);
  });
});

describe('TimelineEntryType', () => {
  it('should have all entry types', () => {
    expect(TimelineEntryType.Note).toBe('note');
    expect(TimelineEntryType.StageChange).toBe('stage_change');
    expect(TimelineEntryType.Assignment).toBe('assignment');
    expect(TimelineEntryType.FollowUpSet).toBe('follow_up_set');
    expect(TimelineEntryType.FollowUpCompleted).toBe('follow_up_completed');
    expect(TimelineEntryType.System).toBe('system');
  });

  it('should have exactly 6 members', () => {
    const values = Object.values(TimelineEntryType);
    expect(values).toHaveLength(6);
  });
});
