import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export let defaultDocClient: DynamoDBDocumentClient | undefined;
let injectedDocClient: DynamoDBDocumentClient | undefined;

/**
 * Returns the effective docClient (either injected or default).
 * Lazily initializes the default client to reduce static context budget.
 */
export function getDocClient(): DynamoDBDocumentClient {
  if (injectedDocClient) return injectedDocClient;

  if (!defaultDocClient) {
    const defaultClient = new DynamoDBClient({});
    defaultDocClient = DynamoDBDocumentClient.from(defaultClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true,
      },
    });
  }

  return defaultDocClient;
}

/**
 * Sets a custom docClient for testing purposes.
 */
export function setDocClient(docClient: DynamoDBDocumentClient): void {
  injectedDocClient = docClient;
}
