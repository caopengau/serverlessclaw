interface ApiContext {
  memoryTable: sst.aws.DynamoDB;
  traceTable: sst.aws.DynamoDB;
  secrets: Record<string, sst.Secret>;
  bus: sst.aws.Bus;
  deployer: sst.aws.CodeBuild;
}

export function createApi(ctx: ApiContext) {
  const { memoryTable, traceTable, secrets, bus, deployer } = ctx;

  const api = new sst.aws.ApiGatewayV2('WebhookApi');

  // Main Webhook
  api.route('POST /webhook', {
    handler: 'src/agents/webhook.handler',
    link: [memoryTable, traceTable, ...Object.values(secrets), deployer, bus],
  });

  // Health Probe
  api.route('GET /health', {
    handler: 'src/agents/health.handler',
    link: [memoryTable],
  });

  return { api };
}
