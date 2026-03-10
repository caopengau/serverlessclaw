import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { IMemory, Message, MessageRole } from './types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export class DynamoMemory implements IMemory {
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
        role: item.role as MessageRole,
        content: item.content,
        tool_calls: item.tool_calls,
        tool_call_id: item.tool_call_id,
        name: item.name,
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
        ...message,
      },
    });

    try {
      await docClient.send(command);
    } catch (error) {
      console.error('Error saving message to DynamoDB:', error);
    }
  }

  async clearHistory(userId: string) {
    console.log('Clear history requested for', userId);
  }

  async getDistilledMemory(userId: string): Promise<string> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': `DISTILLED#${userId}`,
      },
    });

    try {
      const response = await docClient.send(command);
      return response.Items?.[0]?.content || '';
    } catch (error) {
      console.error('Error retrieving distilled memory from DynamoDB:', error);
      return '';
    }
  }

  async updateDistilledMemory(userId: string, facts: string): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        userId: `DISTILLED#${userId}`,
        timestamp: Date.now(),
        content: facts,
      },
    });

    try {
      await docClient.send(command);
    } catch (error) {
      console.error('Error updating distilled memory in DynamoDB:', error);
    }
  }

  async setGap(gapId: string, details: string): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        userId: `GAP#${gapId}`,
        timestamp: Date.now(),
        content: details,
        status: 'OPEN',
      },
    });

    try {
      await docClient.send(command);
    } catch (error) {
      console.error('Error setting capablity gap in DynamoDB:', error);
    }
  }

  async addLesson(userId: string, lesson: string): Promise<void> {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        userId: `LESSON#${userId}`,
        timestamp: Date.now(),
        content: lesson,
      },
    });

    try {
      await docClient.send(command);
    } catch (error) {
      console.error('Error saving lesson to DynamoDB:', error);
    }
  }

  async getLessons(userId: string): Promise<string[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': `LESSON#${userId}`,
      },
      Limit: 5, // Only get the 5 most recent lessons
      ScanIndexForward: false, // Newest first
    });

    try {
      const response = await docClient.send(command);
      return (response.Items || []).map((item) => item.content);
    } catch (error) {
      console.error('Error retrieving lessons from DynamoDB:', error);
      return [];
    }
  }
}
