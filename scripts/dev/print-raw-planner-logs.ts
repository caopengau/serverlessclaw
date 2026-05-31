import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

async function main() {
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  const client = new CloudWatchLogsClient({ region });
  const logGroupName = '/aws/lambda/serve-prod-PlannerQueueSubscriberHvnofeFunctionFunction-ezmnzacz';

  console.log(`🔍 Fetching latest raw logs from ${logGroupName} (last 10 minutes)...`);

  const response = await client.send(
    new FilterLogEventsCommand({
      logGroupName,
      startTime: Date.now() - 3 * 60 * 60 * 1000,
      limit: 10000,
    })
  );

  const events = response.events || [];
  events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const targetReq = "bd147873-6628-5156-8181-1ae561583655";
  const matched = events.filter(e => e.message?.includes(targetReq));

  console.log(`\n📊 Found ${matched.length} events for request bd147873 in JS:\n`);
  for (const event of matched) {
    const date = new Date(event.timestamp || 0).toISOString();
    console.log(`🕒 [${date}] ${event.message?.trim()}`);
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
});
