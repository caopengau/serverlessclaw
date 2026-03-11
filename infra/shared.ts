export interface SharedContext {
  memoryTable: sst.aws.Dynamo;
  traceTable: sst.aws.Dynamo;
  configTable: sst.aws.Dynamo;
  stagingBucket: sst.aws.Bucket;
  secrets: Record<string, sst.Secret>;
  bus: sst.aws.Bus;
  deployer: aws.codebuild.Project;
  api?: sst.aws.ApiGatewayV2;
}

/**
 * Filter out any undefined secrets before linking to resources.
 *
 * @param secrets - A record of secret names to SST Secret objects.
 * @returns An array of valid (non-undefined) SST Secret objects.
 */
export function getValidSecrets(secrets: Record<string, sst.Secret>): sst.Secret[] {
  return Object.values(secrets).filter((s) => s !== undefined);
}

/**
 * Common configuration for agent functions
 */
export const AGENT_CONFIG = {
  memory: {
    SMALL: '256 MB',
    MEDIUM: '512 MB',
    LARGE: '1024 MB',
  },
  timeout: {
    SHORT: '30 seconds',
    MEDIUM: '60 seconds',
    LONG: '600 seconds',
    MAX: '900 seconds',
  },
} as const;
