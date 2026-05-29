import {
  JobInputNormalizer,
  DefaultJobInputNormalizer,
} from '@claw/core/lib/jobs/normalizer.interface';
import { PluginManager } from '@claw/core/lib/plugin-manager';
import { logger } from '@claw/core/lib/logger';

/**
 * Resolves the job input normalizer.
 * Prioritizes plugin-registered normalizers, falling back to a default implementation.
 */
export const jobInputNormalizer: JobInputNormalizer = new Proxy({} as JobInputNormalizer, {
  get: (_target, prop, receiver) => {
    const normalizer = PluginManager.getJobInputNormalizer() || new DefaultJobInputNormalizer();
    return Reflect.get(normalizer, prop, receiver);
  }
});

/**
 * @deprecated Use PluginManager.register() to register a custom job input normalizer.
 */
export function setJobInputNormalizer(_normalizer: JobInputNormalizer): void {
  logger.warn('[Jobs API] setJobInputNormalizer is deprecated. Register via PluginManager instead.');
}
