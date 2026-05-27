import {
  JobInputNormalizer,
  DefaultJobInputNormalizer,
} from '@claw/core/lib/jobs/normalizer.interface';
import { logger } from '@claw/core/lib/logger';

export let jobInputNormalizer: JobInputNormalizer = new DefaultJobInputNormalizer();

export function setJobInputNormalizer(normalizer: JobInputNormalizer): void {
  jobInputNormalizer = normalizer;
  logger.info('[Jobs API] Custom job input normalizer registered');
}
