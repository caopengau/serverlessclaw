/**
 * Shared Agent Helper Utilities
 * Decomposed into sub-modules to maintain small file size and high AI readiness.
 */

import { AgentRole } from '../types/index';
import { normalizeBaseUserId } from './normalize';
import { buildProcessOptions, ProcessOptionsParams, initAgent } from './agent-helpers/init';

/**
 * Extract the base userId by removing CONV# prefix if present.
 */
export function extractBaseUserId(userId: string): string {
  return normalizeBaseUserId(userId);
}

export function isE2ETest(): boolean {
  const lifecycle = process.env.npm_lifecycle_event || '';
  const isVitest =
    process.env.VITEST ||
    process.env.CLAW_TEST === 'true' ||
    process.env.CORE_TEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    (globalThis as any).__vitest_worker__ !== undefined ||
    process.argv.some((arg) => arg.includes('vitest')) ||
    lifecycle.includes('test') ||
    lifecycle.includes('check') ||
    (globalThis as any).__CLAW_TEST__ === true ||
    (globalThis as any).CLAW_TEST === true ||
    (globalThis as any).IS_CLAW_TEST === true ||
    new Error().stack?.includes('.test.ts');

  return !!(process.env.PLAYWRIGHT || process.env.CI || isVitest);
}

/**
 * High-level agent execution helper.
 */
export async function processWithAgent(
  agentId: string | AgentRole,
  userId: string,
  task: string,
  options: ProcessOptionsParams
) {
  const { agent } = await initAgent(agentId, { workspaceId: options.workspaceId });
  return agent.process(userId, task, buildProcessOptions(options));
}

// Re-export all from sub-modules
export * from './agent-helpers/core';
export * from './agent-helpers/validation';
export * from './agent-helpers/init';
