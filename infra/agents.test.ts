import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const agentsSource = readFileSync(resolve(__dirname, 'agents.ts'), 'utf-8');

describe('EventBridge routing contracts', () => {
  describe('RealtimeBridgeSubscriber', () => {
    it('excludes EventType.CHUNK from the subscriber pattern to avoid double publishing', () => {
      // Extract the RealtimeBridgeSubscriber block
      const bridgeMatch = agentsSource.match(
        /bus\.subscribe\('RealtimeBridgeSubscriber'[\s\S]*?pattern:\s*\{[\s\S]*?detailType:\s*\[([\s\S]*?)\]/m
      );
      expect(bridgeMatch).toBeTruthy();
      const detailTypes = bridgeMatch![1];
      expect(detailTypes).not.toContain('EventType.CHUNK');
    });

    it('includes OUTBOUND_MESSAGE for dashboard notifications', () => {
      const bridgeMatch = agentsSource.match(
        /bus\.subscribe\('RealtimeBridgeSubscriber'[\s\S]*?pattern:\s*\{[\s\S]*?detailType:\s*\[([\s\S]*?)\]/m
      );
      expect(bridgeMatch).toBeTruthy();
      expect(bridgeMatch![1]).toContain('EventType.OUTBOUND_MESSAGE');
    });
  });

  describe('AgentRunnerSubscriber', () => {
    it('uses prefix matching for dynamic tasks', () => {
      const agentRunnerMatch = agentsSource.match(
        /bus\.subscribe\('AgentRunnerSubscriber'[\s\S]*?prefix:\s*'dynamic_'/m
      );
      expect(agentRunnerMatch).toBeTruthy();
    });
  });
});
