import {
  SharedContext,
  AGENT_CONFIG,
  LAMBDA_ARCHITECTURE,
  NODEJS_LOADERS,
  LOG_RETENTION_PERIOD,
} from '../shared';

interface MonitorOptions {
  prefix: string;
  liveInLocalOnly: boolean | undefined;
  baseLink: any[];
  basePermissions: any[];
}

export function createMonitors(ctx: SharedContext, options: MonitorOptions) {
  const { memoryTable, bus, deployer, stagingBucket, deployerLink, dlq } = ctx;
  const { prefix, liveInLocalOnly, baseLink, basePermissions } = options;

  // 2. Build Monitor
  const buildMonitor = new sst.aws.Function('BuildMonitor', {
    handler: `${prefix}packages/core/handlers/monitor.handler`,
    dev: liveInLocalOnly as any,
    link: [...baseLink, stagingBucket, deployerLink, ...(ctx.multiplexer ? [ctx.multiplexer] : [])],
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    environment: { TRACE_SUMMARIES_ENABLED: 'true' },
    permissions: [
      ...basePermissions,
      {
        actions: ['codebuild:BatchGetBuilds'],
        resources: [deployer.arn],
      },
      {
        actions: ['logs:GetLogEvents'],
        resources: [
          deployer.name.apply(
            (name) =>
              $util.interpolate`arn:aws:logs:${aws.getRegionOutput().name}:${aws.getCallerIdentityOutput().accountId}:log-group:/aws/codebuild/${name}:*`
          ),
        ],
      },
    ],
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.MEDIUM,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  // 5. CodeBuild Event Rule (Monitor both success and failure for gap lifecycle)
  const buildRule = new aws.cloudwatch.EventRule('BuildRule', {
    eventPattern: $util.jsonStringify({
      source: ['aws.codebuild'],
      'detail-type': ['CodeBuild Build State Change'],
      detail: {
        'build-status': ['FAILED', 'SUCCEEDED', 'STOPPED', 'TIMED_OUT', 'FAULT'],
        'project-name': [deployer.name],
      },
    }),
  });

  new aws.cloudwatch.EventTarget('BuildTarget', {
    rule: buildRule.name,
    arn: buildMonitor.arn,
    deadLetterConfig: dlq ? { arn: dlq.arn } : undefined,
  });

  new aws.lambda.Permission('BuildPermission', {
    action: 'lambda:InvokeFunction',
    function: buildMonitor.name,
    principal: 'events.amazonaws.com',
    sourceArn: buildRule.arn,
  });

  // 10. Concurrency Monitor (System health)
  const concurrencyMonitor = new sst.aws.Function('ConcurrencyMonitor', {
    handler: `${prefix}packages/core/handlers/concurrency-monitor.handler`,
    dev: liveInLocalOnly as any,
    link: [memoryTable, bus],
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    permissions: [...basePermissions, { actions: ['lambda:GetAccountSettings'], resources: ['*'] }],
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.SHORT,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  return {
    buildMonitor,
    concurrencyMonitor,
  };
}
