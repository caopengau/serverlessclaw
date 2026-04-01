import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ITool } from '../lib/types/tool';

// --- Mock definitions ---
const mockLocalTool: ITool = {
  name: 'localTool',
  description: 'A local tool',
  parameters: { type: 'object' as const },
  execute: vi.fn(),
};

const mockSearchTool: ITool = {
  name: 'searchTool',
  description: 'A search tool',
  parameters: { type: 'object' as const },
  execute: vi.fn(),
};

const mockExternalTool: ITool = {
  name: 'externalTool',
  description: 'An external MCP tool',
  parameters: { type: 'object' as const },
  execute: vi.fn(),
};

const mockExternalSearch: ITool = {
  name: 'mcpSearch',
  description: 'External search',
  parameters: { type: 'object' as const },
  execute: vi.fn(),
};

vi.mock('../lib/registry', () => ({
  AgentRegistry: {
    getAgentConfig: vi.fn(),
  },
}));

vi.mock('../lib/mcp', () => ({
  MCPBridge: {
    getExternalTools: vi.fn(),
  },
}));

vi.mock('./index', () => ({
  TOOLS: {
    localTool: mockLocalTool,
    searchTool: mockSearchTool,
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// --- Imports after mocks ---
import { getAgentTools, getToolDefinitions } from './registry-utils';
import { AgentRegistry } from '../lib/registry';
import { MCPBridge } from '../lib/mcp';

describe('registry-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('getAgentTools', () => {
    it('should return local tools when config has matching tool names', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
        id: 'agent-1',
        name: 'Agent',
        tools: ['localTool'],
        systemPrompt: '',
        enabled: true,
      } as any);
      vi.mocked(MCPBridge.getExternalTools).mockResolvedValue([]);

      const result = await getAgentTools('agent-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('localTool');
    });

    it('should return external MCP tools when they match config tool names', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
        id: 'agent-2',
        name: 'Agent',
        tools: ['externalTool'],
        systemPrompt: '',
        enabled: true,
      } as any);
      vi.mocked(MCPBridge.getExternalTools).mockResolvedValue([mockExternalTool]);

      const result = await getAgentTools('agent-2');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('externalTool');
    });

    it('should merge local and external tools', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
        id: 'agent-3',
        name: 'Agent',
        tools: ['localTool', 'externalTool'],
        systemPrompt: '',
        enabled: true,
      } as any);
      vi.mocked(MCPBridge.getExternalTools).mockResolvedValue([mockExternalTool]);

      const result = await getAgentTools('agent-3');
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name)).toEqual(['localTool', 'externalTool']);
    });

    it('should return empty array when config is null', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue(null as any);

      const result = await getAgentTools('agent-missing');
      expect(result).toEqual([]);
    });

    it('should return empty array when config is undefined', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue(undefined as any);

      const result = await getAgentTools('agent-missing');
      expect(result).toEqual([]);
    });

    it('should return empty array when config.tools is empty', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
        id: 'agent-4',
        name: 'Agent',
        tools: [],
        systemPrompt: '',
        enabled: true,
      } as any);

      const result = await getAgentTools('agent-4');
      expect(result).toEqual([]);
    });

    it('should return empty array when config.tools is undefined', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
        id: 'agent-5',
        name: 'Agent',
        systemPrompt: '',
        enabled: true,
      } as any);

      const result = await getAgentTools('agent-5');
      expect(result).toEqual([]);
    });

    it('should filter out local tool names that do not exist in TOOLS', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
        id: 'agent-6',
        name: 'Agent',
        tools: ['nonExistentTool', 'localTool'],
        systemPrompt: '',
        enabled: true,
      } as any);
      vi.mocked(MCPBridge.getExternalTools).mockResolvedValue([]);

      const result = await getAgentTools('agent-6');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('localTool');
    });

    it('should only include external tools whose names are in config.tools', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
        id: 'agent-7',
        name: 'Agent',
        tools: ['mcpSearch'],
        systemPrompt: '',
        enabled: true,
      } as any);
      vi.mocked(MCPBridge.getExternalTools).mockResolvedValue([
        mockExternalTool,
        mockExternalSearch,
      ]);

      const result = await getAgentTools('agent-7');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('mcpSearch');
    });

    it('should return empty when no local tools match and no external tools match', async () => {
      vi.mocked(AgentRegistry.getAgentConfig).mockResolvedValue({
        id: 'agent-8',
        name: 'Agent',
        tools: ['doesNotExist'],
        systemPrompt: '',
        enabled: true,
      } as any);
      vi.mocked(MCPBridge.getExternalTools).mockResolvedValue([mockExternalTool]);

      const result = await getAgentTools('agent-8');
      expect(result).toEqual([]);
    });
  });

  describe('getToolDefinitions', () => {
    it('should return formatted function definitions', () => {
      const tools: Record<string, ITool> = {
        myTool: {
          name: 'myTool',
          description: 'Does things',
          parameters: { type: 'object' as const, properties: { x: { type: 'string' as const } } },
          execute: vi.fn(),
        },
      };

      const defs = getToolDefinitions(tools);
      expect(defs).toHaveLength(1);
      expect(defs[0]).toEqual({
        type: 'function',
        function: {
          name: 'myTool',
          description: 'Does things',
          parameters: { type: 'object', properties: { x: { type: 'string' } } },
        },
      });
    });

    it('should return empty array for empty tool record', () => {
      const defs = getToolDefinitions({});
      expect(defs).toEqual([]);
    });
  });
});
