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

  console.log(`\n📊 All keys containing 1780160289451:\n`);
  const matched = items.filter((item) => {
    return JSON.stringify(item).includes('1780160289451');
  });

  for (const item of matched) {
    console.log(`- Key: ${item.userId} | Type: ${item.type} | Status: ${item.status ?? 'N/A'}`);
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
