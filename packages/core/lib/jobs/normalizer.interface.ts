import { JobSpec } from './types';

/**
 * Generic interface for job input normalization.
 * Implementations can apply domain-specific transformations to job inputs
 * before execution (e.g., fee calculation, model naming, validation).
 */
export interface JobInputNormalizer {
  /**
   * Normalize and transform job inputs based on the job specification.
   * @param spec The job specification
   * @param inputs Raw inputs from the request
   * @returns Normalized inputs ready for execution
   */
  normalize(spec: JobSpec, inputs: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Default implementation that passes inputs through unchanged.
 */
export class DefaultJobInputNormalizer implements JobInputNormalizer {
  normalize(_spec: JobSpec, inputs: Record<string, unknown>): Record<string, unknown> {
    return inputs;
  }
}
