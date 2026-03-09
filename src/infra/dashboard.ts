interface DashboardContext {
  memoryTable: sst.aws.DynamoDB;
  traceTable: sst.aws.DynamoDB;
}

export function createDashboard(ctx: DashboardContext) {
  const { memoryTable, traceTable } = ctx;

  const dashboard = new sst.aws.Nextjs('AdminDashboard', {
    path: 'dashboard',
    link: [memoryTable, traceTable],
  });

  return { dashboard };
}
