import { describe, it, expect } from 'vitest';
import { validatePipelineStages } from '../../validation/pipeline.validator.js';
import { InvalidPipelineError } from '../../errors/index.js';
import type { IPipelineStage } from '@astralibx/call-log-types';
import { PIPELINE_DEFAULTS } from '../../constants/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStage(overrides: Partial<IPipelineStage> = {}): IPipelineStage {
  return {
    stageId: 'stage-1',
    name: 'New',
    color: '#000',
    order: 1,
    isTerminal: false,
    isDefault: true,
    ...overrides,
  };
}

function makeValidStages(): IPipelineStage[] {
  return [
    makeStage({ stageId: 'stage-1', name: 'New', order: 1, isDefault: true, isTerminal: false }),
    makeStage({ stageId: 'stage-2', name: 'Closed', order: 2, isDefault: false, isTerminal: true }),
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validatePipelineStages', () => {
  it('does not throw for a valid pipeline', () => {
    expect(() => validatePipelineStages(makeValidStages())).not.toThrow();
  });

  it('does not throw for a valid pipeline with pipelineId', () => {
    expect(() => validatePipelineStages(makeValidStages(), 'pipe-123')).not.toThrow();
  });

  describe('Rule 1: empty stages', () => {
    it('throws InvalidPipelineError when stages array is empty', () => {
      expect(() => validatePipelineStages([])).toThrow(InvalidPipelineError);
    });

    it('error reason is "Pipeline must have at least one stage"', () => {
      expect(() => validatePipelineStages([])).toThrow(
        'Pipeline must have at least one stage',
      );
    });

    it('error includes pipelineId when provided', () => {
      try {
        validatePipelineStages([], 'pipe-abc');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidPipelineError);
        expect((e as InvalidPipelineError).pipelineId).toBe('pipe-abc');
      }
    });
  });

  describe('Rule 2: no default stage', () => {
    it('throws InvalidPipelineError when no stage is default', () => {
      const stages = [
        makeStage({ stageId: 'stage-1', name: 'New', isDefault: false, isTerminal: true }),
      ];
      expect(() => validatePipelineStages(stages)).toThrow(InvalidPipelineError);
    });

    it('error reason is "Pipeline must have exactly one default stage"', () => {
      const stages = [
        makeStage({ stageId: 'stage-1', name: 'New', isDefault: false, isTerminal: true }),
      ];
      expect(() => validatePipelineStages(stages)).toThrow(
        'Pipeline must have exactly one default stage',
      );
    });
  });

  describe('Rule 3: multiple default stages', () => {
    it('throws InvalidPipelineError when more than one stage is default', () => {
      const stages = [
        makeStage({ stageId: 'stage-1', name: 'New', isDefault: true, isTerminal: false }),
        makeStage({ stageId: 'stage-2', name: 'Open', isDefault: true, isTerminal: false }),
        makeStage({ stageId: 'stage-3', name: 'Closed', isDefault: false, isTerminal: true }),
      ];
      expect(() => validatePipelineStages(stages)).toThrow(InvalidPipelineError);
    });

    it('error reason is "Pipeline must have exactly one default stage"', () => {
      const stages = [
        makeStage({ stageId: 'stage-1', name: 'New', isDefault: true, isTerminal: false }),
        makeStage({ stageId: 'stage-2', name: 'Open', isDefault: true, isTerminal: false }),
        makeStage({ stageId: 'stage-3', name: 'Closed', isDefault: false, isTerminal: true }),
      ];
      expect(() => validatePipelineStages(stages)).toThrow(
        'Pipeline must have exactly one default stage',
      );
    });
  });

  describe('Rule 4: no terminal stage', () => {
    it('throws InvalidPipelineError when no stage is terminal', () => {
      const stages = [
        makeStage({ stageId: 'stage-1', name: 'New', isDefault: true, isTerminal: false }),
        makeStage({ stageId: 'stage-2', name: 'Open', isDefault: false, isTerminal: false }),
      ];
      expect(() => validatePipelineStages(stages)).toThrow(InvalidPipelineError);
    });

    it('error reason is "Pipeline must have at least one terminal stage"', () => {
      const stages = [
        makeStage({ stageId: 'stage-1', name: 'New', isDefault: true, isTerminal: false }),
        makeStage({ stageId: 'stage-2', name: 'Open', isDefault: false, isTerminal: false }),
      ];
      expect(() => validatePipelineStages(stages)).toThrow(
        'Pipeline must have at least one terminal stage',
      );
    });
  });

  describe('Rule 5: duplicate stage names', () => {
    it('throws InvalidPipelineError when stage names are not unique', () => {
      const stages = [
        makeStage({ stageId: 'stage-1', name: 'New', isDefault: true, isTerminal: false }),
        makeStage({ stageId: 'stage-2', name: 'New', isDefault: false, isTerminal: true }),
      ];
      expect(() => validatePipelineStages(stages)).toThrow(InvalidPipelineError);
    });

    it('error reason is "Stage names must be unique within a pipeline"', () => {
      const stages = [
        makeStage({ stageId: 'stage-1', name: 'Duplicate', isDefault: true, isTerminal: false }),
        makeStage({ stageId: 'stage-2', name: 'Duplicate', isDefault: false, isTerminal: true }),
      ];
      expect(() => validatePipelineStages(stages)).toThrow(
        'Stage names must be unique within a pipeline',
      );
    });
  });

  describe('Rule 6: exceeds max stages', () => {
    it(`throws InvalidPipelineError when stages exceed ${PIPELINE_DEFAULTS.MaxStages}`, () => {
      const stages: IPipelineStage[] = Array.from({ length: PIPELINE_DEFAULTS.MaxStages + 1 }, (_, i) => ({
        stageId: `stage-${i}`,
        name: `Stage ${i}`,
        color: '#000',
        order: i,
        isDefault: i === 0,
        isTerminal: i === PIPELINE_DEFAULTS.MaxStages,
      }));
      expect(() => validatePipelineStages(stages)).toThrow(InvalidPipelineError);
    });

    it(`error message mentions ${PIPELINE_DEFAULTS.MaxStages}`, () => {
      const stages: IPipelineStage[] = Array.from({ length: PIPELINE_DEFAULTS.MaxStages + 1 }, (_, i) => ({
        stageId: `stage-${i}`,
        name: `Stage ${i}`,
        color: '#000',
        order: i,
        isDefault: i === 0,
        isTerminal: i === PIPELINE_DEFAULTS.MaxStages,
      }));
      expect(() => validatePipelineStages(stages)).toThrow(
        `Pipeline cannot have more than ${PIPELINE_DEFAULTS.MaxStages} stages`,
      );
    });

    it('does not throw when stages equal max stages', () => {
      const stages: IPipelineStage[] = Array.from({ length: PIPELINE_DEFAULTS.MaxStages }, (_, i) => ({
        stageId: `stage-${i}`,
        name: `Stage ${i}`,
        color: '#000',
        order: i,
        isDefault: i === 0,
        isTerminal: i === PIPELINE_DEFAULTS.MaxStages - 1,
      }));
      expect(() => validatePipelineStages(stages)).not.toThrow();
    });
  });
});
