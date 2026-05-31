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

  const traceId = 'trace-manual-evolution-1780229923205';
  console.log(`🔍 Querying TraceTable (${tableName}) for trace: ${traceId}...`);

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
  const traceItems = items.filter(item => item.traceId === traceId);

  // Sort by timestamp ascending
  traceItems.sort((a, b) => (a.timestamp || a.createdAt || 0) - (b.timestamp || b.createdAt || 0));

  console.log(`\n📊 Found ${traceItems.length} steps for this trace:\n`);

  for (const item of traceItems) {
    console.log(`==================================================`);
    console.log(`NodeId: ${item.nodeId}`);
    console.log(`Timestamp: ${item.timestamp} (${new Date(item.timestamp).toISOString()})`);
    console.log(`AgentId: ${item.agentId} | Type: ${item.type} | Status: ${item.status ?? 'N/A'}`);
    if (item.content) {
      console.log(`Content:`, typeof item.content === 'string' ? item.content.slice(0, 300) : JSON.stringify(item.content).slice(0, 300));
    }
    if (item.metadata) {
      console.log(`Metadata:`, JSON.stringify(item.metadata).slice(0, 300));
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
