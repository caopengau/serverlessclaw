interface DashboardContext {
  memoryTable: sst.aws.Dynamo;
  traceTable: sst.aws.Dynamo;
  configTable: sst.aws.Dynamo;
  api: sst.aws.ApiGatewayV2;
}

export function createDashboard(ctx: DashboardContext) {
  const { memoryTable, traceTable, configTable, api } = ctx;

  const dashboard = new sst.aws.Nextjs('AdminDashboard', {
    path: 'dashboard',
    link: [memoryTable, traceTable, configTable, api],
  });

  return { dashboard };
}
