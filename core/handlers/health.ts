import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { logger } from '../lib/logger';
import { getDeployCountToday } from '../lib/deploy-stats';

/**
 * Health probe Lambda, called by check_health tool after a deployment.
 * Returns 200 OK if the system and DynamoDB state are intact.
 */
export const handler: APIGatewayProxyHandlerV2 = async () => {
  try {
    const deployCount = await getDeployCountToday();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        deployCountToday: deployCount,
        message: 'System healthy.',
      }),
    };
  } catch (error) {
    logger.error('Health check failed:', error);
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
