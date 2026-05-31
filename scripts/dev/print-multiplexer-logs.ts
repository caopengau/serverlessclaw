import { CloudWatchLogsClient, DescribeLogGroupsCommand, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

async function main() {
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  const client = new CloudWatchLogsClient({ region });

  console.log(`🔍 Finding multiplexer log groups...`);
  const prefixes = [
    '/aws/lambda/serverlessclaw-prod-',
    '/aws/lambda/serverlesscla-prod-',
    '/aws/lambda/serverles-prod-',
    '/aws/lambda/serve-prod-'
  ];
  
  const allGroups: any[] = [];
  for (const prefix of prefixes) {
    const describeRes = await client.send(new DescribeLogGroupsCommand({
      logGroupNamePrefix: prefix
    }));
    if (describeRes.logGroups) {
      allGroups.push(...describeRes.logGroups);
    }
  }

  const logGroups = allGroups.filter(g => 
    g.logGroupName?.toLowerCase().includes('multiplexer') || 
    g.logGroupName?.toLowerCase().includes('runner') ||
    g.logGroupName?.toLowerCase().includes('highpower') ||
    g.logGroupName?.toLowerCase().includes('lightpower')
  );
  
  console.log(`📊 Found ${logGroups.length} multiplexer/runner log groups.`);
  for (const g of logGroups) {
    console.log(`  - ${g.logGroupName}`);
  }

  const startTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago

  for (const group of logGroups) {
    const logGroupName = group.logGroupName!;
    try {
      const response = await client.send(
        new FilterLogEventsCommand({
          logGroupName,
          startTime,
          limit: 100,
        })
      );
      const events = response.events || [];
      console.log(`\n=========================================`);
      console.log(`✅ Logs for: ${logGroupName} (${events.length} events)`);
      console.log(`=========================================`);
      events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      for (const event of events) {
        const date = new Date(event.timestamp || 0).toISOString();
        console.log(`  🕒 [${date}] ${event.message?.trim()}`);
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
