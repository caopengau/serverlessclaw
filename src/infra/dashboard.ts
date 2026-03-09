interface DashboardContext {
  memoryTable: sst.aws.Dynamo;
  traceTable: sst.aws.Dynamo;
}

export function createDashboard(ctx: DashboardContext) {
  const { memoryTable, traceTable } = ctx;

  const dashboard = new sst.aws.Nextjs('AdminDashboard', {
    path: 'dashboard',
    link: [memoryTable, traceTable],
  });

  return { dashboard };
}
