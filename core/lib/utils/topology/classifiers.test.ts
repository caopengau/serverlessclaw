import { describe, it, expect } from 'vitest';
import { classifyResource, CLASSIFIERS } from './classifiers';
import { NODE_TYPE, NODE_TIER, NODE_ICON } from './constants';

describe('classifyResource', () => {
  it('returns undefined for unrecognized keys', () => {
    expect(classifyResource('unknownResource')).toBeUndefined();
    expect(classifyResource('')).toBeUndefined();
    expect(classifyResource('randomstuff')).toBeUndefined();
  });

  it('is case-insensitive', () => {
    expect(classifyResource('AgentBus')).toBeDefined();
    expect(classifyResource('AGENTBUS')).toBeDefined();
    expect(classifyResource('agentbus')).toBeDefined();
  });

  describe('bus classifier', () => {
    it('matches agentbus', () => {
      const c = classifyResource('agentbus')!;
      expect(c.type).toBe(NODE_TYPE.BUS);
      expect(c.icon).toBe(NODE_ICON.BUS);
      expect(c.label).toBe('AgentBus (EventBridge)');
      expect(c.tier).toBe(NODE_TIER.COMM);
    });

    it('matches bus', () => {
      const c = classifyResource('bus')!;
      expect(c.type).toBe(NODE_TYPE.BUS);
    });
  });

  describe('api classifier', () => {
    it('matches webhookapi', () => {
      const c = classifyResource('webhookapi')!;
      expect(c.type).toBe(NODE_TYPE.INFRA);
      expect(c.icon).toBe(NODE_ICON.APP);
      expect(c.label).toBe('Webhook API');
      expect(c.tier).toBe(NODE_TIER.APP);
    });

    it('matches keys containing api', () => {
      expect(classifyResource('myapi')).toBeDefined();
      expect(classifyResource('apiservice')).toBeDefined();
      expect(classifyResource('webhookapi')).toBeDefined();
    });
  });

  describe('memory classifier', () => {
    it('matches memorytable', () => {
      const c = classifyResource('memorytable')!;
      expect(c.type).toBe(NODE_TYPE.INFRA);
      expect(c.icon).toBe(NODE_ICON.DATABASE);
      expect(c.label).toBe('Memory (DynamoDB)');
      expect(c.tier).toBe(NODE_TIER.INFRA);
    });

    it('matches memory', () => {
      const c = classifyResource('memory')!;
      expect(c.label).toBe('Memory (DynamoDB)');
    });
  });

  describe('traces classifier', () => {
    it('matches tracetable', () => {
      const c = classifyResource('tracetable')!;
      expect(c.icon).toBe(NODE_ICON.SEARCH);
      expect(c.label).toBe('Traces (DynamoDB)');
    });

    it('matches traces', () => {
      expect(classifyResource('traces')).toBeDefined();
    });
  });

  describe('config classifier', () => {
    it('matches configtable', () => {
      const c = classifyResource('configtable')!;
      expect(c.icon).toBe(NODE_ICON.GEAR);
      expect(c.label).toBe('Config (DynamoDB)');
    });

    it('matches config', () => {
      expect(classifyResource('config')).toBeDefined();
    });
  });

  describe('knowledge classifier', () => {
    it('matches knowledgebucket', () => {
      const c = classifyResource('knowledgebucket')!;
      expect(c.icon).toBe(NODE_ICON.DATABASE);
      expect(c.label).toBe('Knowledge Storage (S3)');
    });

    it('matches knowledge', () => {
      expect(classifyResource('knowledge')).toBeDefined();
    });
  });

  describe('staging classifier', () => {
    it('matches stagingbucket', () => {
      const c = classifyResource('stagingbucket')!;
      expect(c.icon).toBe(NODE_ICON.HAMMER);
      expect(c.label).toBe('Staging Storage (S3)');
    });

    it('matches staging', () => {
      expect(classifyResource('staging')).toBeDefined();
    });
  });

  describe('deployer classifier', () => {
    it('matches deployer', () => {
      const c = classifyResource('deployer')!;
      expect(c.icon).toBe(NODE_ICON.HAMMER);
      expect(c.tier).toBe(NODE_TIER.INFRA);
    });

    it('matches codebuild', () => {
      expect(classifyResource('codebuild')).toBeDefined();
    });
  });

  describe('notifier classifier', () => {
    it('matches notifier', () => {
      const c = classifyResource('notifier')!;
      expect(c.icon).toBe(NODE_ICON.BELL);
      expect(c.tier).toBe(NODE_TIER.COMM);
    });
  });

  describe('dashboard classifier', () => {
    it('matches dashboard', () => {
      const c = classifyResource('dashboard')!;
      expect(c.type).toBe(NODE_TYPE.DASHBOARD);
      expect(c.icon).toBe(NODE_ICON.DASHBOARD);
      expect(c.label).toBe('ClawCenter (Next.js)');
      expect(c.tier).toBe(NODE_TIER.APP);
      expect(c.idOverride).toBe('dashboard');
    });

    it('matches clawcenter', () => {
      const c = classifyResource('clawcenter')!;
      expect(c.type).toBe(NODE_TYPE.DASHBOARD);
      expect(c.idOverride).toBe('dashboard');
    });
  });

  describe('realtime bridge classifier', () => {
    it('matches realtimebridge', () => {
      const c = classifyResource('realtimebridge')!;
      expect(c.icon).toBe(NODE_ICON.SIGNAL);
      expect(c.label).toBe('Realtime Bridge (Lambda)');
      expect(c.tier).toBe(NODE_TIER.COMM);
    });

    it('matches bridge', () => {
      expect(classifyResource('bridge')).toBeDefined();
    });
  });

  describe('realtime bus classifier', () => {
    it('matches realtimebus', () => {
      const c = classifyResource('realtimebus')!;
      expect(c.icon).toBe(NODE_ICON.RADIO);
      expect(c.label).toBe('Realtime Bus (IoT Core)');
    });
  });

  describe('heartbeat classifier', () => {
    it('matches heartbeathandler', () => {
      const c = classifyResource('heartbeathandler')!;
      expect(c.icon).toBe(NODE_ICON.SIGNAL);
      expect(c.label).toBe('Heartbeat Handler');
    });

    it('matches heartbeat', () => {
      expect(classifyResource('heartbeat')).toBeDefined();
    });
  });

  describe('concurrency monitor classifier', () => {
    it('matches concurrencymonitor', () => {
      const c = classifyResource('concurrencymonitor')!;
      expect(c.icon).toBe(NODE_ICON.STETHOSCOPE);
      expect(c.label).toBe('Concurrency Monitor');
    });
  });

  describe('event handler classifier', () => {
    it('matches eventhandler', () => {
      const c = classifyResource('eventhandler')!;
      expect(c.icon).toBe(NODE_ICON.ZAP);
      expect(c.label).toBe('Event Handler');
    });

    it('matches events', () => {
      expect(classifyResource('events')).toBeDefined();
    });
  });

  describe("dead man's switch classifier", () => {
    it('matches deadmansswitch', () => {
      const c = classifyResource('deadmansswitch')!;
      expect(c.label).toBe("Dead Man's Switch");
    });

    it('matches recovery', () => {
      expect(classifyResource('recovery')).toBeDefined();
    });
  });

  describe('mcp server classifier', () => {
    it('matches keys starting with mcp and ending with server', () => {
      const c = classifyResource('mcpgitserver')!;
      expect(c.type).toBe(NODE_TYPE.INFRA);
      expect(c.icon).toBe(NODE_ICON.GEAR);
      expect(c.tier).toBe(NODE_TIER.INFRA);
    });

    it('does not match partial patterns', () => {
      expect(classifyResource('mcpwarmuphandler')).not.toBe(
        CLASSIFIERS.find((c) => c.match('mcpgitserver'))
      );
    });
  });

  describe('mcp warmup handler classifier', () => {
    it('matches mcpwarmuphandler', () => {
      const c = classifyResource('mcpwarmuphandler')!;
      expect(c.icon).toBe(NODE_ICON.SIGNAL);
      expect(c.label).toBe('MCP Warmup Handler');
      expect(c.tier).toBe(NODE_TIER.COMM);
    });
  });

  describe('agent classifier', () => {
    it('matches known agent names', () => {
      const agentNames = [
        'superclaw',
        'coder',
        'strategicplanner',
        'reflector',
        'qa',
        'critic',
        'agentrunner',
      ];
      for (const name of agentNames) {
        const c = classifyResource(name)!;
        expect(c).toBeDefined();
        expect(c.type).toBe(NODE_TYPE.AGENT);
        expect(c.icon).toBe(NODE_ICON.BOT);
        expect(c.tier).toBe(NODE_TIER.AGENT);
      }
    });

    it('matches keys containing agent', () => {
      expect(classifyResource('myagent')).toBeDefined();
      expect(classifyResource('customagent')).toBeDefined();
      expect(classifyResource('agentrunner')).toBeDefined();
    });

    it('matches keys containing worker', () => {
      expect(classifyResource('worker1')).toBeDefined();
      expect(classifyResource('myworker')).toBeDefined();
    });
  });
});

describe('CLASSIFIERS array', () => {
  it('has at least one classifier', () => {
    expect(CLASSIFIERS.length).toBeGreaterThan(0);
  });

  it('each classifier has required properties', () => {
    for (const c of CLASSIFIERS) {
      expect(typeof c.match).toBe('function');
      expect(typeof c.type).toBe('string');
      expect(typeof c.icon).toBe('string');
      expect(typeof c.tier).toBe('string');
    }
  });
});
