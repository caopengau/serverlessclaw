// eslint-disable-next-line @typescript-eslint/triple-slash-reference
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
    const memoryTable = new sst.aws.DynamoDB('MemoryTable', {
      fields: {
        userId: 'string',
        timestamp: 'number',
      },
      primaryIndex: { hashKey: 'userId', rangeKey: 'timestamp' },
    });

    const secrets = {
      TELEGRAM_BOT_TOKEN: new sst.Secret('TelegramBotToken'),
      OPENAI_API_KEY: new sst.Secret('OpenAIApiKey'),
    };

    // 2. The Deployer (CodeBuild) - This is our "Sidecar Agent" for infra changes
    const deployer = new sst.aws.CodeBuild('Deployer', {
      buildspec: 'buildspec.yml',
      environment: {
        computeType: 'BUILD_GENERAL1_SMALL',
      },
    });

    // 3. Multi-Agent Orchestration (EventBridge)
    const bus = new sst.aws.Bus('AgentBus');

    // 4. Sub-Agents
    const coderAgent = new sst.aws.Function('CoderAgent', {
      handler: 'src/coder.handler',
      link: [memoryTable, ...Object.values(secrets)],
    });

    bus.subscribe('coder.task', coderAgent.arn);

    // 5. Webhook API (Main Agent entry point)
    const api = new sst.aws.ApiGatewayV2('WebhookApi');
    api.route('POST /webhook', {
      handler: 'src/webhook.handler',
      link: [memoryTable, ...Object.values(secrets), deployer, bus],
    });

    // 6. Permissions
    // SST v3 'link' handles most of this.

    return {
      apiUrl: api.url,
      deployerName: deployer.name,
      busName: bus.name,
    };
  },
});
