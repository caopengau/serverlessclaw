import { NextRequest, NextResponse } from 'next/server';
import { DynamoMemory } from '@claw/core/lib/memory';

export async function POST(req: NextRequest) {
  try {
    const { userId, timestamp, priority, urgency, impact } = await req.json();

    if (!userId || !timestamp) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const memory = new DynamoMemory();
    
    // Update metadata
    await memory.updateInsightMetadata(userId, timestamp, {
      priority: typeof priority === 'number' ? priority : undefined,
      urgency: typeof urgency === 'number' ? urgency : undefined,
      impact: typeof impact === 'number' ? impact : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Prioritize API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
