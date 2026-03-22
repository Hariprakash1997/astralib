import type { IPipelineStage } from '@astralibx/call-log-types';
import { InvalidPipelineError } from '../errors/index.js';
import { PIPELINE_DEFAULTS } from '../constants/index.js';

/**
 * Validates a pipeline's stages array against all business rules.
 *
 * @param stages - The array of pipeline stages to validate.
 * @param pipelineId - Optional pipeline identifier used in error messages.
 * @throws InvalidPipelineError when any rule is violated.
 */
export function validatePipelineStages(stages: IPipelineStage[], pipelineId?: string): void {
  // Rule 1: Must have at least one stage
  if (stages.length === 0) {
    throw new InvalidPipelineError('Pipeline must have at least one stage', pipelineId);
  }

  // Rule 2 & 3: Must have exactly one default stage
  const defaultStages = stages.filter((s) => s.isDefault);
  if (defaultStages.length === 0) {
    throw new InvalidPipelineError(
      'Pipeline must have exactly one default stage',
      pipelineId,
    );
  }
  if (defaultStages.length > 1) {
    throw new InvalidPipelineError(
      'Pipeline must have exactly one default stage',
      pipelineId,
    );
  }

  // Rule 4: Must have at least one terminal stage
  const terminalStages = stages.filter((s) => s.isTerminal);
  if (terminalStages.length === 0) {
    throw new InvalidPipelineError(
      'Pipeline must have at least one terminal stage',
      pipelineId,
    );
  }

  // Rule 5: Stage names must be unique
  const names = stages.map((s) => s.name);
  const uniqueNames = new Set(names);
  if (uniqueNames.size !== names.length) {
    throw new InvalidPipelineError(
      'Stage names must be unique within a pipeline',
      pipelineId,
    );
  }

  // Rule 6: Cannot exceed max stages
  if (stages.length > PIPELINE_DEFAULTS.MaxStages) {
    throw new InvalidPipelineError(
      `Pipeline cannot have more than ${PIPELINE_DEFAULTS.MaxStages} stages`,
      pipelineId,
    );
  }
}
