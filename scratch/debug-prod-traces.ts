import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

async function debugProductionTraces() {
  console.log('🔍 Debugging Production Traces...');

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client);
  const traceTable = (Resource as any).TraceTable.name;

  console.log(`Table: ${traceTable}`);

  const queryParams = {
    TableName: traceTable,
    IndexName: 'SummaryByNode',
    KeyConditionExpression: 'nodeId = :nodeId',
    ExpressionAttributeValues: { ':nodeId': '__summary__' },
    ScanIndexForward: false,
    Limit: 50,
  };

  try {
    const res = await docClient.send(new QueryCommand(queryParams));
    console.log(`Found ${res.Items?.length ?? 0} traces.`);

    if (res.Items) {
      res.Items.forEach((item) => {
        console.log(
          `- ID: ${item.traceId}, Title: ${item.initialContext?.userText || item.title}, TS: ${item.timestamp}, User: ${item.userId}`
        );
      });
    }
  } catch (e) {
    console.error('Failed to query traces:', e);
  }
}

debugProductionTraces().catch(console.error);
