import { NextResponse } from 'next/server';
import { tools } from '@/lib/tool-definitions';
import { HTTP_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

async function getAllTools(usage: Record<string, { count: number; lastUsed: number }>) {
  try {
    const { MCPBridge } = await import('@claw/core/lib/mcp');
    
    // 1. Local tools
    const localTools = Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      usage: usage[t.name] || { count: 0, lastUsed: 0 },
      isExternal: false
    }));

    // 2. MCP tools
    const externalTools = await MCPBridge.getExternalTools();
    const mcpTools = externalTools.map((t: any) => ({
      name: t.name,
      description: t.description,
      usage: usage[t.name] || { count: 0, lastUsed: 0 },
      isExternal: true
    }));

    return [...localTools, ...mcpTools];
  } catch (e) {
    console.error('Error fetching all tools:', e);
    return Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      usage: usage[t.name] || { count: 0, lastUsed: 0 },
      isExternal: false
    }));
  }
}

async function getToolUsage() {
  try {
    const { AgentRegistry } = await import('@claw/core/lib/registry');
    return (await AgentRegistry.getRawConfig('tool_usage')) as Record<string, { count: number; lastUsed: number }> || {};
  } catch (e) {
    console.error('Error fetching tool usage:', e);
    return {};
  }
}

export async function GET() {
  try {
    const usage = await getToolUsage();
    const allTools = await getAllTools(usage);
    return NextResponse.json(allTools);
  } catch (error) {
    console.error('Failed to fetch tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools' }, 
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
