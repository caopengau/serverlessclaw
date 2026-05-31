import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

async function main() {
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  const client = new CloudWatchLogsClient({ region });
  const logGroupName = '/aws/lambda/serve-prod-PlannerQueueSubscriberHvnofeFunctionFunction-ezmnzacz';

  console.log(`🔍 Fetching latest raw logs from ${logGroupName} (last 10 minutes)...`);

  const response = await client.send(
    new FilterLogEventsCommand({
      logGroupName,
      startTime: Date.now() - 2 * 60 * 1000,
      limit: 1000,
    })
  );

  const events = response.events || [];
  events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  console.log(`\n📊 Found ${events.length} events in the last 2 minutes:\n`);
  for (const event of events) {
    const date = new Date(event.timestamp || 0).toISOString();
    console.log(`🕒 [${date}] ${event.message?.trim()}`);
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
});
