/// <reference path="./.sst/platform/config.d.ts" />

const APP_CONFIG = {
  name: "goldex",
  region: "ap-southeast-2",
  architecture: "arm64" as const,
  runtime: "nodejs24.x",
  retention: "1 month" as const,
} as const;

function getAppRegion(): string {
  return process.env.AWS_REGION?.trim() || APP_CONFIG.region;
}

/**
 * Sovereign SST v4 Platform Configuration for GoldEx.
 * Imports and orchestrates the modular ServerlessClaw OSS core framework.
 */
export default $config({
  app(input: any) {
    const region = getAppRegion();

    return {
      name: APP_CONFIG.name,
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: ["prod"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region,
          version: "7.23.0",
        },
        ...(input?.stage !== "local" && process.env.CLOUDFLARE_API_TOKEN
          ? { cloudflare: "6.13.0" }
          : {}),
      },
      defaults: {
        function: {
          architecture: APP_CONFIG.architecture,
          runtime: APP_CONFIG.runtime,
          environment: {
            AWS_PROFILE: "", // Clear profile to avoid conflict warning as SST injects static credentials
          },
          nodejs: {
            loader: {
              ".md": "text",
            },
            esbuild: {
              // AWS SDK v3 is externalized to optimize Lambda package footprints
              external: [
                "@aws-sdk/*",
                "sonner",
                "react-markdown",
                "remark-gfm",
                "raw-loader",
                "@tailwindcss/postcss",
                "tailwindcss",
                "mqtt",
                "vitest",
                "playwright",
              ],
            },
          },
        },
      },
    };
  },
  async run() {
    const infraOptions = { pathPrefix: "framework/" };

    // Dynamic Imports from ServerlessClaw OSS Core Framework Subtree
    const { createStorage } =
      await import("./packages/infra/storage.ts");
    const { createBus } = await import("./packages/infra/bus.ts");
    const { createDeployer } =
      await import("./packages/infra/deployer.ts");
    const { createApi, configureApiRoutes } =
      await import("./packages/infra/api.ts");
    const { createMCPServers } =
      await import("./packages/infra/mcp-servers.ts");
    const { createAgents } =
      await import("./packages/infra/agents.ts");
    const { createDashboard } =
      await import("./packages/infra/dashboard.ts");

    // 1. Storage & Secrets
    const {
      memoryTable,
      traceTable,
      configTable,
      stagingBucket,
      knowledgeBucket,
      dataLakeBucket,
      secrets,
    } = createStorage();

    // 2. Multi-Agent Orchestration (EventBridge)
    const { bus, realtime, dlq } = createBus(infraOptions);

    // 3. The Deployer (CodeBuild)
    const { deployer, linkable: deployerLink } = createDeployer({
      stagingBucket,
      githubToken: secrets.GitHubToken,
    });

    // 4. API Instance (Created early for linking, routes added later)
    const { api } = createApi({
      memoryTable,
      traceTable,
      configTable,
      stagingBucket,
      knowledgeBucket,
      dataLakeBucket,
      secrets,
      bus,
      deployer,
      deployerLink,
    });

    // 5. MCP Servers
    const mcpServers = createMCPServers(
      {
        memoryTable,
        traceTable,
        configTable,
        stagingBucket,
        knowledgeBucket,
        dataLakeBucket,
        secrets,
        bus,
        deployer,
        deployerLink,
        api,
      },
      infraOptions,
    );
    const multiplexer = mcpServers.multiplexer;

    // 6. Sub-Agents (Handlers & Logic)
    const agentResources = createAgents(
      {
        memoryTable,
        traceTable,
        configTable,
        stagingBucket,
        knowledgeBucket,
        dataLakeBucket,
        secrets,
        bus,
        deployer,
        deployerLink,
        realtime,
        dlq,
        api,
        multiplexer,
      },
      mcpServers,
      infraOptions,
    );

    // 7. API Routes (Configured after agents exist)
    configureApiRoutes(
      api,
      {
        memoryTable,
        traceTable,
        configTable,
        stagingBucket,
        knowledgeBucket,
        dataLakeBucket,
        secrets,
        bus,
        deployer,
        deployerLink,
        agents: agentResources,
      },
      infraOptions,
    );

    // 8. GoldEx Customized ClawCenter Dashboard
    const { dashboard } = createDashboard(
      {
        memoryTable,
        traceTable,
        configTable,
        stagingBucket,
        knowledgeBucket,
        dataLakeBucket,
        secrets,
        bus,
        deployer,
        deployerLink,
        api,
        realtime,
        multiplexer,
        heartbeatHandler: agentResources.heartbeatHandler,
        schedulerRole: agentResources.schedulerRole,
      },
      {
        ...infraOptions,
        // Copies our GoldEx jobs configurations dynamically into the dashboard build bundle
        extensionSource: "apps/goldex-dashboard",
        theme: {
          primaryColor: "#b89b30",
          primaryColorDark: "#ffd700",
          accentColor: "#8c731f",
          accentColorDark: "#ffea6c",
          appTitle: "GoldEx Mission Control",
        },
      },
    );

    // 9. Integration Stacks (GitHub webhook infrastructure)
    const { createGitHubStack } =
      await import("./packages/integration-github/stack.ts");
    const githubResources = createGitHubStack({ bus, dlq }, infraOptions);

    // 10. Billing & Cost Alerts ($5/day Daily Budget)
    const { createBilling } =
      await import("./packages/infra/billing.ts");
    const { billingTopic } = createBilling();

    // 11. Multi-Region Operator Scaling
    const { createMultiRegionScaling } =
      await import("./packages/infra/multi-region.ts");
    const multiRegion = createMultiRegionScaling({
      memoryTable,
      traceTable,
      configTable,
      stagingBucket,
      knowledgeBucket,
      dataLakeBucket,
      secrets,
      bus,
      deployer,
      deployerLink,
      api,
    });

    return {
      apiUrl: api.url,
      dashboardUrl: dashboard.url,
      billingTopicArn: billingTopic?.arn,
      githubBucket: githubResources.githubBucket.name,
      regionSyncQueueUrl: multiRegion.regionSyncQueue.url,
    };
  },
});
