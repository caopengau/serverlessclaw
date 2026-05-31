import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

async function main() {
  // @ts-expect-error - sst resource typing
  const tableName = Resource.TraceTable.name;
  if (!tableName) {
    console.error('❌ TraceTable not found');
    process.exit(1);
  }

  console.log(`🔍 Scanning TraceTable: ${tableName}`);

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  const result = await docClient.send(
    new ScanCommand({
      TableName: tableName,
    })
  );

  const items = result.Items || [];
  console.log(`Total items in TraceTable: ${items.length}`);

  const matched = items.filter(item => {
    const str = JSON.stringify(item);
    return str.includes('1780229012902') || str.includes('trace-manual-evolution') || str.includes('PLAN-');
  });

  console.log(`Matched ${matched.length} items containing gapId or 'trace-manual-evolution' or 'PLAN-':`);
  for (const item of matched) {
    console.log(`--------------------------------------------------`);
    console.log(`TraceId: ${item.traceId}`);
    console.log(`NodeId: ${item.nodeId}`);
    console.log(`Timestamp: ${item.timestamp}`);
    console.log(`Type: ${item.type || item.eventType}`);
    console.log(`Status: ${item.status ?? 'N/A'}`);
    if (item.content) {
      console.log(`Content:`, typeof item.content === 'string' ? item.content.slice(0, 200) : JSON.stringify(item.content).slice(0, 200));
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
