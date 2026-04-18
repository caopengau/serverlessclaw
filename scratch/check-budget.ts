
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

async function checkBudget(traceId: string) {
  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);
  const RECURSION_STACK_PREFIX = 'RECURSION_STACK#';
  
  // We need to find the table name. In your project it's from getMemoryTableName()
  // Usually it's something like 'MemoryTable' from SST.
  // I'll try to guess it or use the env if set.
  const tableName = process.env.MEMORY_TABLE_NAME || 'pengcao-serverlessclaw-MemoryTable';

  try {
    const key = `${RECURSION_STACK_PREFIX}${traceId}`;
    console.log(`Checking budget for key: ${key} in table: ${tableName}`);
    
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { userId: key, timestamp: 0 },
      })
    );

    if (Item) {
      console.log('Budget Entry Found:');
      console.log(JSON.stringify(Item, null, 2));
    } else {
      console.log('No budget entry found for this trace ID.');
    }
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
  }
}

const traceId = 'msg-1776523860526-r2lk2zj';
checkBudget(traceId);
