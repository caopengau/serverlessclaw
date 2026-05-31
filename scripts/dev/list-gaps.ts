import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

async function main() {
  // @ts-expect-error - sst resource typing
  const memoryTableName = Resource.MemoryTable.name;
  // @ts-expect-error - sst resource typing
  const configTableName = Resource.ConfigTable.name;

  if (!memoryTableName || !configTableName) {
    console.error('❌ Table(s) not found');
    process.exit(1);
  }

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  // 1. Scan MemoryTable
  const memoryResult = await docClient.send(
    new ScanCommand({
      TableName: memoryTableName,
    })
  );
  const memoryItems = memoryResult.Items || [];

  console.log(`\n📊 Isolated GAP/gap records in MemoryTable (Total: ${memoryItems.length}):\n`);
  const matched = memoryItems.filter((item) => {
    const key = item.userId ?? '';
    return key.startsWith('GAP#') || key.startsWith('WS#default#GAP#') || key.toLowerCase().includes('gap');
  }).filter(item => {
    const key = item.userId ?? '';
    return key.includes('GAP') || item.type === 'GAP';
  });

  for (const item of matched) {
    console.log(`- Key: ${item.userId} | Type: ${item.type} | Status: ${item.status ?? 'N/A'}`);
    if (item.content) console.log(`  Content:`, typeof item.content === 'string' ? item.content.slice(0, 100) : JSON.stringify(item.content).slice(0, 100));
  }

  // 2. Scan ConfigTable
  const configResult = await docClient.send(
    new ScanCommand({
      TableName: configTableName,
    })
  );
  const configItems = configResult.Items || [];

  console.log(`\n⚙️ evolution_mode value in ConfigTable:\n`);
  const evoModeItem = configItems.find(item => item.key === 'evolution_mode');
  if (evoModeItem) {
    console.log(`- Key: ${evoModeItem.key} | Value:`, JSON.stringify(evoModeItem.value));
  } else {
    console.log(`❌ evolution_mode not found in ConfigTable!`);
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
