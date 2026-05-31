import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

async function main() {
  // @ts-expect-error - sst resource typing
  const tableName = Resource.MemoryTable.name;
  if (!tableName) {
    console.error('❌ MemoryTable not found');
    process.exit(1);
  }

  console.log(`🔍 Scanning MemoryTable: ${tableName}`);

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
  console.log(`Total items in MemoryTable: ${items.length}`);

  const matched = items.filter(item => {
    const str = JSON.stringify(item);
    return str.includes('1780') || str.toLowerCase().includes('gap') || str.includes('evolution');
  });

  console.log(`Matched ${matched.length} items containing '1780', 'gap', or 'evolution':`);
  for (const item of matched.slice(0, 50)) {
    console.log(`--------------------------------------------------`);
    console.log(`Key (userId): ${item.userId}`);
    console.log(`Timestamp: ${item.timestamp}`);
    console.log(`Type: ${item.type} | Status: ${item.status ?? 'N/A'}`);
    if (item.content) {
      console.log(`Content:`, typeof item.content === 'string' ? item.content.slice(0, 200) : JSON.stringify(item.content).slice(0, 200));
    }
    if (item.metadata) {
      console.log(`Metadata:`, JSON.stringify(item.metadata).slice(0, 200));
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
