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

  console.log(`\n📊 Trace records containing 'PLAN-', 'coder', or 'evolution' (Total scanned: ${items.length}):\n`);
  
  const matched = items.filter(item => {
    const str = JSON.stringify(item).toLowerCase();
    return str.includes('plan-') || str.includes('coder') || str.includes('evolution');
  });

  for (const item of matched) {
    console.log(`==================================================`);
    console.log(`Key (traceId): ${item.traceId}`);
    console.log(`Timestamp: ${item.timestamp || item.createdAt}`);
    console.log(`Event: ${item.type || item.eventType}`);
    console.log(`Status: ${item.status ?? 'N/A'}`);
    console.log(`Details:`, JSON.stringify(item).slice(0, 500));
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
