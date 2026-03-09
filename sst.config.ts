/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'serverlessclaw',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: ['production'].includes(input?.stage),
      home: 'aws',
    };
  },
  async run() {
    // 1. Storage & Secrets
    const memoryTable = new sst.aws.Dynamo('MemoryTable', {
      fields: {
        userId: 'string',
        timestamp: 'number',
      },
      primaryIndex: { hashKey: 'userId', rangeKey: 'timestamp' },
    });

    const traceTable = new sst.aws.Dynamo('TraceTable', {
      fields: {
        traceId: 'string',
        userId: 'string',
        timestamp: 'number',
      },
      primaryIndex: { hashKey: 'traceId', rangeKey: 'timestamp' },
      globalIndexes: {
        UserIndex: { hashKey: 'userId', rangeKey: 'timestamp' },
      },
      ttl: 'expiresAt',
    });

    const secrets = {
      TELEGRAM_BOT_TOKEN: new sst.Secret('TelegramBotToken'),
      OPENAI_API_KEY: new sst.Secret('OpenAIApiKey'),
      GITHUB_TOKEN: new sst.Secret('GitHubToken'),
    };

    // 1.5 Staging Storage for Code Evolution
    const stagingBucket = new sst.aws.Bucket('StagingBucket');

    // 2. The Deployer (CodeBuild) - Using low-level AWS provider for v3
    const deployerRole = new aws.iam.Role('DeployerRole', {
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'codebuild.amazonaws.com' },
          },
        ],
      }),
    });

    new aws.iam.RolePolicyAttachment('DeployerAdminPolicy', {
      policyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
      role: deployerRole.name,
    });

    const deployer = new aws.codebuild.Project('Deployer', {
      name: `${$app.name}-${$app.stage}-Deployer`,
      serviceRole: deployerRole.arn,
      artifacts: { type: 'NO_ARTIFACTS' },
      environment: {
        computeType: 'BUILD_GENERAL1_SMALL',
        image: 'aws/codebuild/amazonlinux2-x86_64-standard:5.0',
        type: 'LINUX_CONTAINER',
        environmentVariables: [
          { name: 'SST_STAGE', value: $app.stage },
          { name: 'STAGING_BUCKET_NAME', value: stagingBucket.name },
          { name: 'GITHUB_TOKEN', value: secrets.GITHUB_TOKEN.value },
        ],
      },
      source: {
        type: 'GITHUB',
        location: 'https://github.com/caopengau/serverlessclaw.git',
        buildspec: 'buildspec.yml',
      },
    });

    // 3. Multi-Agent Orchestration (EventBridge)
    const bus = new sst.aws.Bus('AgentBus');

    // 4. API
    const api = new sst.aws.ApiGatewayV2('WebhookApi');

    api.route('POST /webhook', {
      handler: 'src/agents/webhook.handler',
      link: [memoryTable, traceTable, stagingBucket, ...Object.values(secrets), deployer, bus],
    });

    api.route('GET /health', {
      handler: 'src/agents/health.handler',
      link: [memoryTable],
    });

    // 5. Sub-Agents
    const coderAgent = new sst.aws.Function('CoderAgent', {
      handler: 'src/agents/coder.handler',
      link: [memoryTable, traceTable, stagingBucket, ...Object.values(secrets)],
    });
    bus.subscribe('coder_task', coderAgent.arn);

    const buildMonitor = new sst.aws.Function('BuildMonitor', {
      handler: 'src/agents/monitor.handler',
      link: [memoryTable, traceTable, stagingBucket, deployer, bus],
    });

    const eventHandler = new sst.aws.Function('EventHandler', {
      handler: 'src/agents/events.handler',
      link: [memoryTable, traceTable, stagingBucket, ...Object.values(secrets), deployer, bus],
    });
    bus.subscribe('system_build_failed', eventHandler.arn);

    const deadMansSwitch = new sst.aws.Function('DeadMansSwitch', {
      handler: 'src/agents/recovery.handler',
      link: [memoryTable, traceTable, deployer, api],
    });

    // 6. Schedules & Rules
    new aws.scheduler.Schedule('RecoverySchedule', {
      scheduleExpression: 'rate(15 minutes)',
      flexibleTimeWindow: { mode: 'OFF' },
      target: {
        arn: deadMansSwitch.arn,
        roleArn: new aws.iam.Role('RecoveryScheduleRole', {
          assumeRolePolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Action: 'sts:AssumeRole',
                Effect: 'Allow',
                Principal: { Service: 'scheduler.amazonaws.com' },
              },
            ],
          }),
        }).arn,
      },
    });

    new aws.lambda.Permission('RecoveryPermission', {
      action: 'lambda:InvokeFunction',
      function: deadMansSwitch.name,
      principal: 'scheduler.amazonaws.com',
    });

    const buildRule = new aws.cloudwatch.EventRule('BuildRule', {
      eventPattern: JSON.stringify({
        source: ['aws.codebuild'],
        'detail-type': ['CodeBuild Build State Change'],
        detail: {
          'build-status': ['FAILED'],
          'project-name': [deployer.name],
        },
      }),
    });

    new aws.cloudwatch.EventTarget('BuildTarget', {
      rule: buildRule.name,
      arn: buildMonitor.arn,
    });

    new aws.lambda.Permission('BuildPermission', {
      action: 'lambda:InvokeFunction',
      function: buildMonitor.name,
      principal: 'events.amazonaws.com',
      sourceArn: buildRule.arn,
    });

    // 7. Admin Dashboard (Next.js 16)
    const dashboard = new sst.aws.Nextjs('AdminDashboard', {
      path: 'dashboard',
      link: [memoryTable, traceTable],
    });

    return {
      apiUrl: api.url,
      dashboardUrl: dashboard.url,
      deployerName: deployer.name,
      busName: bus.name,
    };
  },
});
