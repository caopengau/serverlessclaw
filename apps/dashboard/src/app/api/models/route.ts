import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-utils';
import { logger } from '@claw/core/lib/logger';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import {
  ModelRegistry,
  ModelRegistryPayload,
  ModelRegistryRecord,
} from '@claw/core/lib/models/registry.interface';

export const dynamic = 'force-dynamic';

/**
 * Default model registry that returns empty records.
 * Can be replaced with a domain-specific implementation (e.g., GoldexModelRegistry).
 */
class DefaultModelRegistry implements ModelRegistry {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async read(_workspaceId: string): Promise<ModelRegistryPayload> {
    return { models: {} };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async write(_workspaceId: string, _payload: ModelRegistryPayload): Promise<void> {
    // No-op
  }
}

/**
 * Optional custom model registry implementation.
 * Can be replaced with a domain-specific implementation (e.g., GoldexModelRegistry).
 * Defaults to a no-op registry if not provided.
 */
let modelRegistry: ModelRegistry = new DefaultModelRegistry();

/**
 * Set custom model registry implementation.
 * This allows domain-specific implementations to be injected.
 */
export function setModelRegistry(registry: ModelRegistry): void {
  modelRegistry = registry;
  logger.info('[Models API] Custom model registry registered');
}

async function assertAuthorized(
  req: NextRequest,
  workspaceId: string
): Promise<NextResponse | null> {
  const userId = getUserId(req);
  const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
  const identityManager = await getIdentityManager();
  const hasPermission = await identityManager.hasPermission(
    userId,
    Permission.TASK_CREATE,
    workspaceId
  );

  if (!hasPermission) {
    return NextResponse.json(
      { error: 'Unauthorized workspace access or missing pipeline permission' },
      { status: HTTP_STATUS.FORBIDDEN }
    );
  }

  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'default';
    const unauthorized = await assertAuthorized(req, workspaceId);
    if (unauthorized) {
      return unauthorized;
    }

    const payload = await modelRegistry.read(workspaceId);
    const models = Object.entries(payload.models || {})
      .map(([modelName, record]) => ({
        modelName,
        ...record,
      }))
      .sort((a, b) => {
        const aTime = new Date(
          (a as ModelRegistryRecord & { registeredAt?: string }).registeredAt || 0
        ).getTime();
        const bTime = new Date(
          (b as ModelRegistryRecord & { registeredAt?: string }).registeredAt || 0
        ).getTime();
        return bTime - aTime;
      });

    return NextResponse.json({
      models,
      latestModel: (payload as { latestModel?: string }).latestModel || null,
      lastUpdatedAt: (payload as { lastUpdatedAt?: string }).lastUpdatedAt || null,
    });
  } catch (error) {
    logger.error('[Models API] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'default';
    const unauthorized = await assertAuthorized(req, workspaceId);
    if (unauthorized) {
      return unauthorized;
    }

    const body = (await req.json()) as { modelName?: unknown; label?: unknown };
    const modelName = String(body.modelName || '').trim();
    if (!modelName) {
      return NextResponse.json(
        { error: 'Missing parameter: modelName' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const rawLabel = typeof body.label === 'string' ? body.label.trim() : '';
    const label = rawLabel.slice(0, 120);

    const payload = await modelRegistry.read(workspaceId);
    const record = payload.models?.[modelName];
    if (!record || typeof record !== 'object') {
      return NextResponse.json(
        { error: `Model '${modelName}' was not found in registry` },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    if (label) {
      record.label = label;
      record.labelUpdatedAt = new Date().toISOString();
    } else {
      delete record.label;
      delete record.labelUpdatedAt;
    }

    payload.models[modelName] = record;
    (payload as { lastUpdatedAt?: string }).lastUpdatedAt = new Date().toISOString();
    await modelRegistry.write(workspaceId, payload);

    return NextResponse.json({
      success: true,
      model: {
        modelName,
        ...record,
      },
    });
  } catch (error) {
    logger.error('[Models API] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
