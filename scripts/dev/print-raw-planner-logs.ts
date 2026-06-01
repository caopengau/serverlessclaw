import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

async function main() {
  const region = process.env.AWS_REGION || 'ap-southeast-2';
  const client = new CloudWatchLogsClient({ region });
  const logGroupName = '/aws/lambda/serve-prod-PlannerQueueSubscriberHvnofeFunctionFunction-ezmnzacz';

  console.log(`🔍 Fetching latest raw logs from ${logGroupName} (last 10 minutes)...`);

  const response = await client.send(
    new FilterLogEventsCommand({
      logGroupName,
      startTime: Date.now() - 10 * 60 * 1000,
      limit: 1000,
    })
  );

  const events = response.events || [];
  events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  console.log(`\n📊 Analyzing ${events.length} events for safety violations and blocks:\n`);
  for (let i = 0; i < events.length; i++) {
    const msg = events[i].message || '';
    if (msg.includes('Safety violation detected') || msg.includes('Action blocked for agent')) {
      console.log(`\n🚨 FOUND VIOLATION/BLOCK AT INDEX ${i}:`);
      const start = Math.max(0, i - 4);
      const end = Math.min(events.length - 1, i + 4);
      for (let j = start; j <= end; j++) {
        const date = new Date(events[j].timestamp || 0).toISOString();
        const prefix = j === i ? '🔴 >>>' : '🕒';
        console.log(`${prefix} [${date}] ${events[j].message?.trim()}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
});
