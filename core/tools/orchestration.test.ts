import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SIGNAL_ORCHESTRATION } from './orchestration';
import { AgentStatus, AgentType } from '../lib/types/agent';
import { logger } from '../lib/logger';

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('SIGNAL_ORCHESTRATION Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully emit a SUCCESS signal', async () => {
    const args = {
      status: AgentStatus.SUCCESS,
      reasoning: 'The task was completed according to requirements.',
      nextStep: 'Notify the user of completion.',
      targetAgentId: AgentType.SUPERCLAW,
    };

    const result = await SIGNAL_ORCHESTRATION.execute(args);

    expect(result).toContain('ORCHESTRATION_SIGNAL_EMITTED: SUCCESS');
    expect(result).toContain('Reasoning: The task was completed according to requirements.');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('SUCCESS'));
  });

  it('should successfully emit a PIVOT signal with target agent', async () => {
    const args = {
      status: AgentStatus.PIVOT,
      reasoning: 'The task requires deep architectural analysis.',
      nextStep: 'Analyze the system topology for bottlenecks.',
      targetAgentId: AgentType.STRATEGIC_PLANNER,
    };

    const result = await SIGNAL_ORCHESTRATION.execute(args);

    expect(result).toContain('ORCHESTRATION_SIGNAL_EMITTED: PIVOT');
    expect(result).toContain('Target Agent: strategic-planner');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('PIVOT'));
  });

  it('should successfully emit an ESCALATE signal', async () => {
    const args = {
      status: AgentStatus.ESCALATE,
      reasoning: 'The user requested a change to a protected system file.',
      nextStep: 'Ask the user for manual approval to modify core/lib/auth.ts',
      targetAgentId: AgentType.SUPERCLAW,
    };

    const result = await SIGNAL_ORCHESTRATION.execute(args);

    expect(result).toContain('ORCHESTRATION_SIGNAL_EMITTED: ESCALATE');
    expect(result).toContain('Next Step: Ask the user for manual approval');
  });
});
