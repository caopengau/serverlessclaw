interface DashboardContext {
  memoryTable: sst.aws.Dynamo;
  traceTable: sst.aws.Dynamo;
  api: sst.aws.ApiGatewayV2;
}

export function createDashboard(ctx: DashboardContext) {
  const { memoryTable, traceTable, api } = ctx;

  const dashboard = new sst.aws.Nextjs('AdminDashboard', {
    path: 'dashboard',
    link: [memoryTable, traceTable, api],
  });

  return { dashboard };
}
