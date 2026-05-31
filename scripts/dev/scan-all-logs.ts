import { CloudWatchLogsClient, DescribeLogGroupsCommand, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

async function main() {
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  const client = new CloudWatchLogsClient({ region });

  console.log(`🔍 Finding all production log groups...`);
  const prefixes = [
    '/aws/lambda/serverlessclaw-prod-',
    '/aws/lambda/serverlesscla-prod-',
    '/aws/lambda/serverles-prod-',
    '/aws/lambda/serve-prod-'
  ];
  
  const logGroups: any[] = [];
  for (const prefix of prefixes) {
    const describeRes = await client.send(new DescribeLogGroupsCommand({
      logGroupNamePrefix: prefix
    }));
    if (describeRes.logGroups) {
      logGroups.push(...describeRes.logGroups);
    }
  }
  console.log(`📊 Found ${logGroups.length} log groups.`);

  const startTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

  for (const group of logGroups) {
    const logGroupName = group.logGroupName!;
    try {
      const response = await client.send(
        new FilterLogEventsCommand({
          logGroupName,
          startTime,
          limit: 10,
        })
      );
      const events = response.events || [];
      if (events.length > 0) {
        console.log(`\n✅ Activity found in Log Group: ${logGroupName} (${events.length} events)`);
        events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        for (const event of events) {
          const date = new Date(event.timestamp || 0).toISOString();
          console.log(`  🕒 [${date}] ${event.message?.trim().slice(0, 300)}`);
        }
      }
    } catch (err: any) {
      if (err.name !== 'ResourceNotFoundException') {
        console.error(`❌ Error querying ${logGroupName}:`, err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
});
