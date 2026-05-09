import { logger } from '../../../logger';
import { getStagingBucketName } from '../../../utils/resource-helpers';
import { pruneStagingBucket } from '../repairs';
import { AuditFinding } from '../../../../agents/cognition-reflector/lib/audit-definitions';

/**
 * Remediation for S3/Staging inconsistencies.
 */
export async function remediateS3Failure(workspaceId?: string): Promise<AuditFinding | undefined> {
  const bucketName = getStagingBucketName();
  if (bucketName && bucketName !== 'StagingBucket') {
    try {
      const reclaimed = await pruneStagingBucket({ workspaceId });
      if (reclaimed > 0) {
        return {
          silo: 'Metabolism',
          expected: 'Accessible staging artifacts',
          actual: `Real-time repair: Metabolized staging bucket to clear access/stale inconsistencies.`,
          severity: 'P2',
          recommendation: 'S3 state reset performed. Retrying operation may now succeed.',
        };
      }
    } catch (e) {
      logger.error(`[Metabolism] S3 staging bucket remediation failed:`, e);
    }
  }
  return undefined;
}
