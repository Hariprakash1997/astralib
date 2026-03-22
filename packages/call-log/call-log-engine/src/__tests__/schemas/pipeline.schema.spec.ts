import { describe, it, expect } from 'vitest';
import { Schema } from 'mongoose';
import { PipelineSchema, PipelineStageSchema } from '../../schemas/pipeline.schema.js';

describe('PipelineStageSchema', () => {
  it('stageId is a String path', () => {
    const path = PipelineStageSchema.path('stageId');
    expect(path).toBeDefined();
    expect(path).toBeInstanceOf(Schema.Types.String);
  });

  it('stageId has a default function (UUID)', () => {
    const path = PipelineStageSchema.path('stageId') as any;
    const defaultVal = path.defaultValue?.();
    expect(typeof defaultVal).toBe('string');
    expect(defaultVal).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('name is required', () => {
    const path = PipelineStageSchema.path('name') as any;
    expect(path.isRequired).toBe(true);
  });

  it('color is required', () => {
    const path = PipelineStageSchema.path('color') as any;
    expect(path.isRequired).toBe(true);
  });

  it('order is required', () => {
    const path = PipelineStageSchema.path('order') as any;
    expect(path.isRequired).toBe(true);
  });

  it('isTerminal defaults to false', () => {
    const path = PipelineStageSchema.path('isTerminal') as any;
    expect(path.defaultValue).toBe(false);
  });

  it('isDefault defaults to false', () => {
    const path = PipelineStageSchema.path('isDefault') as any;
    expect(path.defaultValue).toBe(false);
  });
});

describe('PipelineSchema', () => {
  it('pipelineId is required and has a UUID default', () => {
    const path = PipelineSchema.path('pipelineId') as any;
    expect(path.isRequired).toBe(true);
    const defaultVal = path.defaultValue?.();
    expect(typeof defaultVal).toBe('string');
    expect(defaultVal).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('name is required', () => {
    const path = PipelineSchema.path('name') as any;
    expect(path.isRequired).toBe(true);
  });

  it('description is optional', () => {
    const path = PipelineSchema.path('description') as any;
    expect(path.isRequired).toBeFalsy();
  });

  it('isActive defaults to true', () => {
    const path = PipelineSchema.path('isActive') as any;
    expect(path.defaultValue).toBe(true);
  });

  it('isDeleted defaults to false', () => {
    const path = PipelineSchema.path('isDeleted') as any;
    expect(path.defaultValue).toBe(false);
  });

  it('isDefault defaults to false', () => {
    const path = PipelineSchema.path('isDefault') as any;
    expect(path.defaultValue).toBe(false);
  });

  it('createdBy is required', () => {
    const path = PipelineSchema.path('createdBy') as any;
    expect(path.isRequired).toBe(true);
  });

  it('tenantId is optional', () => {
    const path = PipelineSchema.path('tenantId') as any;
    expect(path.isRequired).toBeFalsy();
  });

  it('stages is an array path', () => {
    const path = PipelineSchema.path('stages');
    expect(path).toBeDefined();
    expect(path).toBeInstanceOf(Schema.Types.DocumentArray);
  });

  it('has timestamps option', () => {
    expect((PipelineSchema as any).options.timestamps).toBe(true);
  });
});
