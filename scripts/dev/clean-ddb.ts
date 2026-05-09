import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

/**
 * DynamoDB Data Cleanse Script
 * Cleans up HEALTH# and RECOVERY# records from the MemoryTable to keep it lean.
 *
 * Usage: sst shell npx tsx scripts/dev/clean-ddb.ts
 */

async function main() {
  const stage = process.env.SST_STAGE || 'local';
  console.log(`Starting DDB data cleanse for stage: ${stage}...`);

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);

  // @ts-expect-error - sst resource typing
  const tableName = Resource.MemoryTable.name;

  if (!tableName) {
    console.error(
      'Error: MemoryTable not found in Resource. Ensure you are running via "sst shell"'
    );
    process.exit(1);
  }

  const prefixes = ['HEALTH#', 'DISTILLED#RECOVERY', 'RECOVERY#', 'GAP_LOCK#'];
  let totalDeleted = 0;

  for (const prefix of prefixes) {
    console.log(`Cleaning up items with prefix: ${prefix}...`);
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
        console.log(`Found ${scanResult.Items.length} items to delete.`);

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

  console.log(`Successfully deleted ${totalDeleted} items from ${tableName}.`);
}

main().catch(console.error);
