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

  console.log(`📍 Target TraceTable: ${tableName}`);

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
  // Sort by timestamp descending
  items.sort((a, b) => {
    const timeA = a.timestamp || a.createdAt || 0;
    const timeB = b.timestamp || b.createdAt || 0;
    return timeB - timeA;
  });

  console.log(`\n📊 Recent trace records (Total scanned: ${items.length}):\n`);
  for (const item of items.slice(0, 5)) {
    console.log(`==================================================`);
    console.log(`Key (traceId): ${item.traceId}`);
    console.log(`Timestamp: ${item.timestamp || item.createdAt} (${new Date(item.timestamp || item.createdAt).toISOString()})`);
    console.log(`Event: ${item.type || item.eventType}`);
    console.log(`Status: ${item.status ?? 'N/A'}`);
    console.log(`Details:`, JSON.stringify(item).slice(0, 300));
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
