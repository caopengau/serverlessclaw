import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { GapStatus } from '../../packages/core/lib/types/agent';

async function createTestGap() {
  // @ts-expect-error - sst resource typing
  const memoryTableName = Resource.MemoryTable.name;
  const gapTimestamp = Date.now();
  const gapId = `GAP#${gapTimestamp}`;

  const client = new DynamoDBClient({ region: 'ap-southeast-2' });
  const docClient = DynamoDBDocumentClient.from(client);

  const gap = {
    userId: gapId,
    timestamp: gapTimestamp,
    type: 'GAP',
    status: GapStatus.OPEN,
    content:
      'Test gap for evolution verification - add simple health dashboard widget showing system state',
    details:
      'Create a lightweight health status widget for dashboard showing: agents online count, memory usage percentage, evolution loop detection status, last deployment timestamp. Implementation: React component + API endpoint',
    createdAt: gapTimestamp,
    metadata: {
      priority: 6,
      category: 'CAPABILITY',
      impact: 'medium',
      lastAccessed: gapTimestamp,
    },
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: memoryTableName,
        Item: gap,
      })
    );
    console.log(`✅ Test gap created: ${gapId}`);
    console.log(`   Timestamp: ${gapTimestamp}`);
    console.log(`   Status: ${gap.status}`);
    console.log(`   Content: ${gap.content}`);
    return gapTimestamp;
  } catch (error) {
    console.error('❌ Failed to create test gap:', error);
    process.exit(1);
  }
}

createTestGap();
