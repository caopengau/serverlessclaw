/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "serverlessclaw",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    const memoryTable = new sst.aws.DynamoDB("MemoryTable", {
      fields: {
        userId: "string",
        timestamp: "number",
      },
      primaryIndex: { hashKey: "userId", rangeKey: "timestamp" },
    });

    const secrets = {
      TELEGRAM_BOT_TOKEN: new sst.Secret("TelegramBotToken"),
      OPENAI_API_KEY: new sst.Secret("OpenAIApiKey"),
    };

    const api = new sst.aws.ApiGatewayV2("WebhookApi");
    api.route("POST /webhook", {
      handler: "src/webhook.handler",
      link: [memoryTable, ...Object.values(secrets)],
    });

    return {
      apiUrl: api.url,
    };
  },
});
