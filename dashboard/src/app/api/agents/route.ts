import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { NextResponse } from 'next/server';

import { AgentRegistry } from '@claw/core/lib/registry';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function GET() {
  try {
    const configs = await AgentRegistry.getAllConfigs();
    return NextResponse.json(configs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tableName = (Resource as any).ConfigTable?.name;
    if (!tableName) {
      return NextResponse.json({ error: 'ConfigTable name is missing' }, { status: 500 });
    }
    const body = await request.json();
    
    // Validate or transform body if necessary
    // Current body is Record<string, AgentConfig>
    
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: { 
          key: 'agents_config', 
          value: body 
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating agents config:', error);
    return NextResponse.json({ error: 'Failed to update agents' }, { status: 500 });
  }
}
