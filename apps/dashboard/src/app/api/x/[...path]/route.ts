import { NextRequest, NextResponse } from 'next/server';
import { PluginManager } from '@claw/core/lib/plugin-manager';
import { logger } from '@claw/core/lib/logger';

/**
 * Dynamic API Gateway for Plugin-registered routes.
 *
 * Routes registered via PluginManager.dashboard.apiRoutes are accessible here.
 * Example: if a plugin registers 'goldex/simulate', it will be available at /api/x/goldex/simulate
 */

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams.path);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams.path);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams.path);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams.path);
}

async function handleRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/');
  const routes = PluginManager.getApiRoutes();

  const handler = routes[path];
  if (!handler) {
    logger.debug(`[Dynamic API] Route not found: ${path}`);
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const result = await handler(req);
    if (result instanceof Response) {
      return result;
    }
    return NextResponse.json(result);
  } catch (error) {
    logger.error(`[Dynamic API] Error handling route ${path}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: 500 }
    );
  }
}
