import { describe, it, expect } from 'vitest';
import { Schema } from 'mongoose';
import { CallLogSchema, ContactRefSchema, TimelineEntrySchema, StageChangeSchema } from '../../schemas/call-log.schema.js';
import { CallDirection, CallPriority, TimelineEntryType } from '@astralibx/call-log-types';

describe('ContactRefSchema', () => {
  it('externalId is required', () => {
    const path = ContactRefSchema.path('externalId') as any;
    expect(path.isRequired).toBe(true);
  });

  it('displayName is required', () => {
    const path = ContactRefSchema.path('displayName') as any;
    expect(path.isRequired).toBe(true);
  });

  it('phone is optional', () => {
    const path = ContactRefSchema.path('phone') as any;
    expect(path.isRequired).toBeFalsy();
  });

  it('email is optional', () => {
    const path = ContactRefSchema.path('email') as any;
    expect(path.isRequired).toBeFalsy();
  });
});

describe('TimelineEntrySchema', () => {
  it('entryId has UUID default', () => {
    const path = TimelineEntrySchema.path('entryId') as any;
    const defaultVal = path.defaultValue?.();
    expect(typeof defaultVal).toBe('string');
    expect(defaultVal).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('type is required with enum from TimelineEntryType', () => {
    const path = TimelineEntrySchema.path('type') as any;
    expect(path.isRequired).toBe(true);
    const enumValues = path.enumValues;
    for (const val of Object.values(TimelineEntryType)) {
      expect(enumValues).toContain(val);
    }
  });
});

describe('StageChangeSchema', () => {
  it('fromStageId is required', () => {
    const path = StageChangeSchema.path('fromStageId') as any;
    expect(path.isRequired).toBe(true);
  });

  it('toStageId is required', () => {
    const path = StageChangeSchema.path('toStageId') as any;
    expect(path.isRequired).toBe(true);
  });

  it('changedBy is required', () => {
    const path = StageChangeSchema.path('changedBy') as any;
    expect(path.isRequired).toBe(true);
  });

  it('changedAt is required', () => {
    const path = StageChangeSchema.path('changedAt') as any;
    expect(path.isRequired).toBe(true);
  });

  it('timeInStageMs is required', () => {
    const path = StageChangeSchema.path('timeInStageMs') as any;
    expect(path.isRequired).toBe(true);
  });
});

describe('CallLogSchema', () => {
  it('callLogId is required with UUID default', () => {
    const path = CallLogSchema.path('callLogId') as any;
    expect(path.isRequired).toBe(true);
    const defaultVal = path.defaultValue?.();
    expect(typeof defaultVal).toBe('string');
    expect(defaultVal).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('pipelineId is required', () => {
    const path = CallLogSchema.path('pipelineId') as any;
    expect(path.isRequired).toBe(true);
  });

  it('currentStageId is required', () => {
    const path = CallLogSchema.path('currentStageId') as any;
    expect(path.isRequired).toBe(true);
  });

  it('contactRef is required and is a subdocument', () => {
    const path = CallLogSchema.path('contactRef');
    expect(path).toBeDefined();
    expect(path).toBeInstanceOf(Schema.Types.Subdocument);
  });

  it('direction is required with enum from CallDirection', () => {
    const path = CallLogSchema.path('direction') as any;
    expect(path.isRequired).toBe(true);
    const enumValues = path.enumValues;
    for (const val of Object.values(CallDirection)) {
      expect(enumValues).toContain(val);
    }
  });

  it('callDate is required', () => {
    const path = CallLogSchema.path('callDate') as any;
    expect(path.isRequired).toBe(true);
  });

  it('priority is required with default medium and enum from CallPriority', () => {
    const path = CallLogSchema.path('priority') as any;
    expect(path.isRequired).toBe(true);
    expect(path.defaultValue).toBe(CallPriority.Medium);
    const enumValues = path.enumValues;
    for (const val of Object.values(CallPriority)) {
      expect(enumValues).toContain(val);
    }
  });

  it('agentId is required and is an ObjectId path', () => {
    const path = CallLogSchema.path('agentId') as any;
    expect(path.isRequired).toBe(true);
    expect(path).toBeInstanceOf(Schema.Types.ObjectId);
  });

  it('isClosed defaults to false', () => {
    const path = CallLogSchema.path('isClosed') as any;
    expect(path.defaultValue).toBe(false);
  });

  it('tags defaults to empty array', () => {
    const path = CallLogSchema.path('tags') as any;
    expect(path).toBeInstanceOf(Schema.Types.Array);
    const defaultVal = path.defaultValue?.();
    expect(Array.isArray(defaultVal)).toBe(true);
    expect(defaultVal.length).toBe(0);
  });

  it('timeline is an array path', () => {
    const path = CallLogSchema.path('timeline');
    expect(path).toBeDefined();
    expect(path).toBeInstanceOf(Schema.Types.DocumentArray);
  });

  it('stageHistory is an array path', () => {
    const path = CallLogSchema.path('stageHistory');
    expect(path).toBeDefined();
    expect(path).toBeInstanceOf(Schema.Types.DocumentArray);
  });

  it('tenantId is optional', () => {
    const path = CallLogSchema.path('tenantId') as any;
    expect(path.isRequired).toBeFalsy();
  });

  it('has timestamps option', () => {
    expect((CallLogSchema as any).options.timestamps).toBe(true);
  });
});
