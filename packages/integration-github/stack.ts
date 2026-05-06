/**
 * GitHub Integration Stack
 * Example of a project-specific infrastructure layer.
 */

export function createGitHubStack(
  resources: { bus: sst.aws.Bus; dlq?: sst.aws.Queue } & Record<string, any>,
  options: { pathPrefix?: string } = {}
) {
  const { bus, dlq } = resources;
  const prefix = options.pathPrefix ?? '';

  // Example: A specialized bucket for GitHub artifacts
  const githubBucket = new sst.aws.Bucket('GitHubArtifacts');

  // Example: A rule to notify on specific GitHub events
  const releaseNotifier = new sst.aws.Function('ReleaseNotifier', {
    handler: `${prefix}packages/integration-github/src/handlers/release-notifier.handler`,
    link: [githubBucket],
  });

  bus.subscribe('GitHubReleaseCreated', releaseNotifier.arn, {
    transform: {
      target: {
        deadLetterConfig: dlq ? { arn: dlq.arn } : undefined,
      },
    },
  });

  return { githubBucket };
}
