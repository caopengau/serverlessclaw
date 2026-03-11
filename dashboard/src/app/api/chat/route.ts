import { NextRequest, NextResponse } from 'next/server';
import { DynamoMemory } from '@claw/core/lib/memory';
import { Agent } from '@claw/core/lib/agent';
import { ProviderManager } from '@claw/core/lib/providers/index';
import { getAgentTools } from '@claw/core/tools/index';
import { SUPERCLAW_SYSTEM_PROMPT } from '@claw/core/agents/superclaw';
import { UI_STRINGS, HTTP_STATUS } from '@/lib/constants';

/**
 * Handles chat messages from the dashboard UI using the Manager agent
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { text } = await req.json();
    const userId = 'dashboard-user'; // Fixed ID for dashboard chat

    if (!text) {
      return NextResponse.json({ error: UI_STRINGS.MISSING_MESSAGE }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    // We initialize these inside the handler because they depend on Resources 
    // being available in the environment.
    const memory = new DynamoMemory();
    const provider = new ProviderManager();
    const agentTools = await getAgentTools('main');
    const agent = new Agent(memory, provider, agentTools, SUPERCLAW_SYSTEM_PROMPT);

    const reply = await agent.process(userId, text);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error(UI_STRINGS.API_CHAT_ERROR, error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
