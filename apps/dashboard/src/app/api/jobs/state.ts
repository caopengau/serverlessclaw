import {
  JobInputNormalizer,
  DefaultJobInputNormalizer,
} from '@claw/core/lib/jobs/normalizer.interface';
import { logger } from '@claw/core/lib/logger';

/**
 * Optional custom job input normalizer for domain-specific transformations.
 * Can be replaced with a domain-specific implementation (e.g., GoldexJobInputNormalizer).
 * Defaults to a pass-through normalizer if not provided.
 */
let jobInputNormalizer: JobInputNormalizer = new DefaultJobInputNormalizer();

/**
 * Set custom job input normalizer.
 * This allows domain-specific implementations to be injected.
 */
export function setJobInputNormalizer(normalizer: JobInputNormalizer): void {
  jobInputNormalizer = normalizer;
  logger.info('[Jobs API] Custom job input normalizer registered');
}

export function getJobInputNormalizer(): JobInputNormalizer {
  return jobInputNormalizer;
}
