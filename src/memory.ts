import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class DynamoMemory {
  private tableName = Resource.MemoryTable.name;

  async getHistory(userId: string): Promise<Message[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: true, // Oldest first
    });

    try {
      const response = await docClient.send(command);
      return (response.Items || []).map((item) => ({
        role: item.role,
        content: item.content,
      }));
    } catch (error) {
      console.error('Error retrieving history from DynamoDB:', error);
      return [];
    }
  }

  async addMessage(userId: string, message: Message) {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        userId,
        timestamp: Date.now(),
        role: message.role,
        content: message.content,
      },
    });

    try {
      await docClient.send(command);
    } catch (error) {
      console.error('Error saving message to DynamoDB:', error);
    }
  }
}
