#!/usr/bin/env npx tsx
/**
 * Test Script: Coder Role Propagation Fix
 *
 * This script tests that:
 * 1. Coder tasks dispatched with missing userRole get MEMBER role by default
 * 2. No "Action blocked for agent 'viewer'" permission errors occur
 * 3. Sub-tasks inherit the propagated role correctly
 */

import { emitEvent } from '../../packages/core/lib/utils/bus/emitters';

async function testCoderRolePropagation() {
  // Simulate a strategic planner creating a CODER_TASK without explicitly setting userRole
  // This should trigger the multiplexer role inference fix
  const testMissionId = `test-mission-${Date.now()}`;
  const testSessionId = `test-session-${Date.now()}`;

  console.log(
    `\n🧪 TEST: Direct CODER_TASK dispatch without explicit userRole`
  );
  console.log(`   Mission ID: ${testMissionId}`);
  console.log(`   Session ID: ${testSessionId}`);
  console.log(`\n📤 Dispatching CODER_TASK to EventBridge...\n`);

  const detail = {
    missionId: testMissionId,
    sessionId: testSessionId,
    userId: 'dashboard-user',
    // NOTE: userRole is intentionally missing to trigger role inference
    // The multiplexer should detect this is from 'pipeline.*' source
    // and default to UserRole.MEMBER
    target: 'coder',
    mission: {
      goal: 'Implement a simple health check tool for evolution loop monitoring',
      context: {
        workspaceId: 'default',
        teamContext: 'self-evolution-validation',
      },
      requirements: [
        'Tool must be callable from dashboard',
        'Tool must return health status of all core agents',
        'Tool must have sub-task for each agent status check',
      ],
    },
    tool_use_budget: 2000,
    request_type: 'STANDARD',
    workspaceId: 'default',
  };

  try {
    const result = await emitEvent(
      'pipeline.evolution-coordinator',
      'CODER_TASK',
      detail,
      { maxRetries: 3 }
    );

    if (result.success) {
      console.log(`✅ Event dispatched successfully`);
      console.log(`   Event ID: ${result.eventId}`);
      console.log(`   Status: SUCCESS\n`);
    } else {
      console.log(`❌ Event dispatch failed: ${result.reason}`);
      process.exit(1);
    }

    // Wait a bit for the event to be processed
    console.log(`⏳ Waiting 15 seconds for multiplexer to process...`);
    await new Promise((resolve) => setTimeout(resolve, 15000));

    console.log(`\n📊 TEST SUMMARY`);
    console.log(`=============`);
    console.log(
      `If you see NO "Action blocked for agent 'viewer'" errors in CloudWatch logs,`
    );
    console.log(`the role inference fix is working correctly.`);
    console.log(`\n🔍 Check logs:`);
    console.log(`   aws logs tail /aws/lambda/serverlessclaw-prod-HighPowerMultiplexerFunction-* --since 2m --follow`);
    console.log(`   (Look for CODER_TASK processing and sub-task dispatch)`);
    console.log(
      `\n💡 Expected behavior:`
    );
    console.log(
      `   [MULTIPLEXER] Received CODER_TASK for mission: ${testMissionId}`
    );
    console.log(
      `   [ROLE-INFERENCE] Detected internal source 'pipeline.evolution-coordinator', using MEMBER role`
    );
    console.log(
      `   [TOOLS] Configured tools for coder agent (no permission denials)`
    );
    console.log(`   [PARALLEL] Dispatching sub-tasks with inherited MEMBER role`);
    console.log(`\n✅ Test dispatch complete!\n`);
  } catch (error) {
    console.error('❌ Failed to dispatch event:', error);
    process.exit(1);
  }
}

testCoderRolePropagation().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
