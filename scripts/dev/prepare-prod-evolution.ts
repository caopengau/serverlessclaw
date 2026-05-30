import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

/**
 * Production Self-Evolution Preparation Script
 * 1. Cleanses the production MemoryTable of any previous GAP#, GAP_LOCK#, or COOLDOWN# records.
 * 2. Seeds exactly one fresh high-impact strategic capability gap to trigger live autonomous evolution.
 *
 * Usage: AWS_PROFILE=aiready sst shell --stage prod npx tsx scripts/dev/prepare-prod-evolution.ts
 */

async function main() {
  const stage = process.env.SST_STAGE || 'prod';
  console.log(`🧹 Starting production database cleanse for stage: ${stage}...`);

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  // @ts-expect-error - sst resource typing
  const tableName = Resource.MemoryTable.name;

  if (!tableName) {
    console.error(
      '❌ Error: MemoryTable not found in Resource. Ensure you are running via "sst shell"'
    );
    process.exit(1);
  }

  console.log(`📍 Using target MemoryTable: ${tableName}`);

  // 1. Clean up old records to isolate the E2E test
  const prefixes = ['GAP#', 'GAP_LOCK#', 'COOLDOWN#'];
  let totalDeleted = 0;

  for (const prefix of prefixes) {
    console.log(`🔍 Scanning for items with prefix: ${prefix}...`);
    let lastEvaluatedKey: any = undefined;

    do {
      const scanResult = await docClient.send(
        new ScanCommand({
          TableName: tableName,
          FilterExpression: 'begins_with(userId, :prefix)',
          ExpressionAttributeValues: {
            ':prefix': prefix,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      if (scanResult.Items && scanResult.Items.length > 0) {
        console.log(`🗑️ Found ${scanResult.Items.length} items to delete with prefix ${prefix}.`);

        for (const item of scanResult.Items) {
          await docClient.send(
            new DeleteCommand({
              TableName: tableName,
              Key: {
                userId: item.userId,
                timestamp: item.timestamp,
              },
            })
          );
          totalDeleted++;
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  }

  console.log(`✅ Successfully cleaned up ${totalDeleted} active/stale records.`);

  // 2. Seed exactly one high-impact E2E strategic gap
  const now = Date.now();
  const targetGapId = `gap_${now}`;

  console.log(`🌱 Seeding fresh strategic gap: ${targetGapId}...`);

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        userId: `GAP#${now}`,
        timestamp: now,
        createdAt: now,
        type: 'GAP',
        content:
          'I wish I had a tool to check if the self-evolution loop is active and return the health status of all core agents. Currently, I have to inspect them manually.',
        status: 'OPEN',
        workspaceId: 'default',
        metadata: {
          category: 'strategic_gap',
          impact: 8,
          urgency: 8,
          complexity: 4,
          confidence: 8,
          risk: 3,
          priority: 8,
          createdAt: now,
          updatedAt: now,
        },
      },
    })
  );

  console.log(
    '🎉 Preparation complete! A fresh GAP is seeded and the stage is set for a live, E2E self-evolution loop.'
  );
}

main().catch((err) => {
  console.error('❌ Preparation failed:', err);
  process.exit(1);
});
