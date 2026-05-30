import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

async function main() {
  const gapId = process.argv[2];
  if (!gapId) {
    console.error('Usage: npx tsx scripts/dev/query-gap-status.ts <gapId>');
    process.exit(1);
  }

  // @ts-expect-error - sst resource typing
  const tableName = Resource.MemoryTable.name;
  if (!tableName) {
    console.error('❌ MemoryTable not found');
    process.exit(1);
  }

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log(`🔍 Scanning MemoryTable (${tableName}) for references to ${gapId}...`);

  const result = await docClient.send(
    new ScanCommand({
      TableName: tableName,
    })
  );

  const items = result.Items || [];
  const related = items.filter((item) => {
    const str = JSON.stringify(item);
    return str.includes(gapId);
  });

  console.log(`\n📊 Found ${related.length} related records:\n`);

  for (const item of related) {
    console.log(`--------------------------------------------------`);
    console.log(`🔹 Key: ${item.userId} | Timestamp: ${item.timestamp}`);
    console.log(`🔹 Type: ${item.type} | Status: ${item.status ?? 'N/A'}`);
    if (item.content) {
      const displayContent =
        typeof item.content === 'string' && item.content.startsWith('{')
          ? JSON.stringify(JSON.parse(item.content), null, 2)
          : item.content;
      console.log(`🔹 Content:`, displayContent);
    }
    if (item.metadata) {
      console.log(`🔹 Metadata:`, JSON.stringify(item.metadata, null, 2));
    }
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
