import { NextResponse, NextRequest } from 'next/server';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CONFIG_KEYS } from '@claw/core/lib/constants';
import { SSTResource } from '@claw/core/lib/types/index';
import { logger } from '@claw/core/lib/logger';

export const dynamic = 'force-dynamic';

const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);
const typedResource = Resource as unknown as SSTResource;

/**
 * Returns public configuration for the dashboard.
 * Safe to call from client components.
 */
export async function GET(req: NextRequest) {
  try {
    // Debug diagnostic: log the MQTT URL being used by the client
    const debugUrl = req.nextUrl?.searchParams?.get('__debug_url');
    if (debugUrl) {
      logger.debug('[Config API] [DEBUG] Client MQTT URL:', decodeURIComponent(debugUrl));
      return NextResponse.json({ ok: true });
    }
    const realtime = typedResource.RealtimeBus;
    const realtimeUrl =
      realtime && typeof realtime.endpoint === 'string'
        ? realtime.endpoint.startsWith('wss://')
          ? realtime.endpoint
          : realtime.endpoint.startsWith('https://')
            ? realtime.endpoint.replace('https://', 'wss://')
            : `wss://${realtime.endpoint}`
        : null;

    if (!realtimeUrl) {
      logger.warn('[Config API] RealtimeBus is not linked; realtime URL is unavailable');
    }

    return NextResponse.json({
      app: Resource.App.name,
      stage: Resource.App.stage,
      realtime: {
        url: realtimeUrl,
        authorizer: realtime?.authorizer,
      },
    });
  } catch (error) {
    logger.error('[Config API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

/**
 * Updates system configuration values.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    // Only allow specific safe keys to be updated from the client if needed,
    // or keep it generic if the dashboard is protected.
    if (key === CONFIG_KEYS.ACTIVE_LOCALE) {
      const tableName = typedResource.ConfigTable?.name;
      if (!tableName) {
        return NextResponse.json({ error: 'ConfigTable name is missing' }, { status: 500 });
      }
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            key: key,
            value: value,
          },
        })
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unauthorized configuration key' }, { status: 403 });
  } catch (error) {
    logger.error('[Config API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
