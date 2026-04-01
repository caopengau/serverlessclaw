import { describe, it, expect } from 'vitest';
import { AgentStatus, AgentType } from '../types/agent';
import { OrchestrationSignalSchema } from './orchestration';

describe('OrchestrationSignalSchema', () => {
  const minimalValid = {
    status: AgentStatus.SUCCESS,
    reasoning: 'Task completed successfully.',
  };

  describe('valid signal validation', () => {
    it('should validate SUCCESS signal with minimal fields', () => {
      const result = OrchestrationSignalSchema.parse(minimalValid);
      expect(result.status).toBe(AgentStatus.SUCCESS);
      expect(result.reasoning).toBe('Task completed successfully.');
    });

    it('should validate FAILED signal', () => {
      const result = OrchestrationSignalSchema.parse({
        status: AgentStatus.FAILED,
        reasoning: 'Goal is unreachable due to missing dependencies.',
      });
      expect(result.status).toBe(AgentStatus.FAILED);
    });

    it('should validate RETRY signal', () => {
      const result = OrchestrationSignalSchema.parse({
        status: AgentStatus.RETRY,
        reasoning: 'Need to retry with updated parameters.',
        nextStep: 'Re-attempt with corrected input.',
      });
      expect(result.status).toBe(AgentStatus.RETRY);
    });

    it('should validate PIVOT signal', () => {
      const result = OrchestrationSignalSchema.parse({
        status: AgentStatus.PIVOT,
        reasoning: 'Current strategy not working, delegating to specialist.',
        nextStep: 'Hand off to QA agent for verification.',
        targetAgentId: AgentType.QA,
      });
      expect(result.status).toBe(AgentStatus.PIVOT);
      expect(result.targetAgentId).toBe(AgentType.QA);
    });

    it('should validate ESCALATE signal', () => {
      const result = OrchestrationSignalSchema.parse({
        status: AgentStatus.ESCALATE,
        reasoning: 'Ambiguous requirements, need human input.',
        nextStep: 'Should we use REST or GraphQL for the new endpoint?',
      });
      expect(result.status).toBe(AgentStatus.ESCALATE);
    });

    it('should validate CONTINUE signal', () => {
      const result = OrchestrationSignalSchema.parse({
        status: AgentStatus.CONTINUE,
        reasoning: 'Task is still in progress.',
      });
      expect(result.status).toBe(AgentStatus.CONTINUE);
    });

    it('should validate REOPEN signal', () => {
      const result = OrchestrationSignalSchema.parse({
        status: AgentStatus.REOPEN,
        reasoning: 'Previously completed task needs re-evaluation.',
      });
      expect(result.status).toBe(AgentStatus.REOPEN);
    });

    it('should validate with all fields populated', () => {
      const input = {
        status: AgentStatus.PIVOT,
        reasoning: 'Switching strategy after analysis.',
        nextStep: 'Delegate to merger agent.',
        targetAgentId: AgentType.MERGER,
        metadata: { priority: 'high', source: 'orchestrator' },
      };
      const result = OrchestrationSignalSchema.parse(input);
      expect(result).toEqual(input);
    });
  });

  describe('invalid signal rejection', () => {
    it('should reject invalid status value', () => {
      expect(() =>
        OrchestrationSignalSchema.parse({ status: 'INVALID', reasoning: 'test' })
      ).toThrow();
    });

    it('should reject missing status', () => {
      expect(() => OrchestrationSignalSchema.parse({ reasoning: 'test' })).toThrow();
    });

    it('should reject missing reasoning', () => {
      expect(() => OrchestrationSignalSchema.parse({ status: AgentStatus.SUCCESS })).toThrow();
    });

    it('should reject empty string reasoning', () => {
      expect(() =>
        OrchestrationSignalSchema.parse({ status: AgentStatus.SUCCESS, reasoning: '' })
      ).toThrow();
    });

    it('should reject extra fields due to strict mode', () => {
      expect(() =>
        OrchestrationSignalSchema.parse({
          ...minimalValid,
          unknownField: 'should fail',
        })
      ).toThrow();
    });

    it('should reject invalid targetAgentId enum', () => {
      expect(() =>
        OrchestrationSignalSchema.parse({
          status: AgentStatus.PIVOT,
          reasoning: 'test',
          targetAgentId: 'nonexistent-agent',
        })
      ).toThrow();
    });

    it('should reject non-string reasoning', () => {
      expect(() =>
        OrchestrationSignalSchema.parse({ status: AgentStatus.SUCCESS, reasoning: 123 })
      ).toThrow();
    });
  });

  describe('required fields', () => {
    it('should require status', () => {
      const { status: _status, ...rest } = minimalValid;
      expect(() => OrchestrationSignalSchema.parse(rest)).toThrow();
    });

    it('should require reasoning', () => {
      const { reasoning: _reasoning, ...rest } = minimalValid;
      expect(() => OrchestrationSignalSchema.parse(rest)).toThrow();
    });
  });

  describe('optional fields', () => {
    it('should make nextStep optional', () => {
      const result = OrchestrationSignalSchema.parse(minimalValid);
      expect(result.nextStep).toBeUndefined();
    });

    it('should make targetAgentId optional', () => {
      const result = OrchestrationSignalSchema.parse(minimalValid);
      expect(result.targetAgentId).toBeUndefined();
    });

    it('should make metadata optional', () => {
      const result = OrchestrationSignalSchema.parse(minimalValid);
      expect(result.metadata).toBeUndefined();
    });

    it('should accept metadata as record', () => {
      const result = OrchestrationSignalSchema.parse({
        ...minimalValid,
        metadata: { key1: 'value1', key2: 42, nested: { a: true } },
      });
      expect(result.metadata).toEqual({ key1: 'value1', key2: 42, nested: { a: true } });
    });

    it('should accept empty metadata object', () => {
      const result = OrchestrationSignalSchema.parse({
        ...minimalValid,
        metadata: {},
      });
      expect(result.metadata).toEqual({});
    });
  });

  describe('all AgentStatus enum values', () => {
    it.each([
      AgentStatus.SUCCESS,
      AgentStatus.FAILED,
      AgentStatus.CONTINUE,
      AgentStatus.REOPEN,
      AgentStatus.RETRY,
      AgentStatus.PIVOT,
      AgentStatus.ESCALATE,
    ])('should accept AgentStatus.%s', (status) => {
      const result = OrchestrationSignalSchema.parse({
        status,
        reasoning: `Testing ${status} status.`,
      });
      expect(result.status).toBe(status);
    });
  });

  describe('all AgentType enum values for targetAgentId', () => {
    it.each(Object.values(AgentType))(
      'should accept AgentType.%s as targetAgentId',
      (agentType) => {
        const result = OrchestrationSignalSchema.parse({
          status: AgentStatus.PIVOT,
          reasoning: `Delegating to ${agentType}.`,
          targetAgentId: agentType,
        });
        expect(result.targetAgentId).toBe(agentType);
      }
    );
  });
});
