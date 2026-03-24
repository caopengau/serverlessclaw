import { describe, it, expect } from 'vitest';
import { parseStructuredResponse } from './llm-utils';

describe('parseStructuredResponse', () => {
  it('should parse plain JSON directly', () => {
    const input = '{"status":"SUCCESS","plan":"test plan"}';
    const result = parseStructuredResponse<{ status: string; plan: string }>(input);
    expect(result).toEqual({ status: 'SUCCESS', plan: 'test plan' });
  });

  it('should parse JSON wrapped in markdown code fences', () => {
    const input = '```json\n{"status":"SUCCESS","plan":"test"}\n```';
    const result = parseStructuredResponse<{ status: string; plan: string }>(input);
    expect(result).toEqual({ status: 'SUCCESS', plan: 'test' });
  });

  it('should parse JSON with leading/trailing whitespace', () => {
    const input = '  \n{"status":"SUCCESS"}\n  ';
    const result = parseStructuredResponse<{ status: string }>(input);
    expect(result).toEqual({ status: 'SUCCESS' });
  });

  it('should strip [TOOL_CALL] blocks before parsing', () => {
    const input = [
      '{"status":"SUCCESS","plan":"Gather data first."',
      '[TOOL_CALL]',
      '{tool => "listAgents", args => {',
      '}}',
      '[/TOOL_CALL]',
      '}',
    ].join('\n');
    const result = parseStructuredResponse<{ status: string; plan: string }>(input);
    expect(result.status).toBe('SUCCESS');
    expect(result.plan).toBe('Gather data first.');
  });

  it('should strip multiple [TOOL_CALL] blocks and parse JSON in between', () => {
    const input = [
      '[TOOL_CALL]',
      '{tool => "listAgents", args => {}}',
      '[/TOOL_CALL]',
      '{"status":"SUCCESS","plan":"plan text","coveredGapIds":[]}',
      '[TOOL_CALL]',
      '{tool => "recallKnowledge", args => {}}',
      '[/TOOL_CALL]',
    ].join('\n');
    const result = parseStructuredResponse<{
      status: string;
      plan: string;
      coveredGapIds: string[];
    }>(input);
    expect(result.status).toBe('SUCCESS');
    expect(result.coveredGapIds).toEqual([]);
  });

  it('should throw when non-JSON text remains after stripping [TOOL_CALL] blocks', () => {
    const input = [
      'Some preamble text the LLM may produce.',
      '[TOOL_CALL]',
      '{tool => "listAgents", args => {}}',
      '[/TOOL_CALL]',
      '{"status":"SUCCESS","plan":"plan text","coveredGapIds":[]}',
      '[TOOL_CALL]',
      '{tool => "recallKnowledge", args => {}}',
      '[/TOOL_CALL]',
    ].join('\n');
    // After stripping TOOL_CALL blocks, "Some preamble text..." + JSON remain,
    // which is not valid JSON.
    expect(() => parseStructuredResponse(input)).toThrow(
      'Failed to parse structured response from LLM'
    );
  });

  it('should strip [TOOL_CALL] blocks with multiline args', () => {
    const input = [
      '{"status":"SUCCESS","plan":"done"}',
      '',
      '[TOOL_CALL]',
      '{tool => "inspectTopology", args => {',
      '  "someArg": "value",',
      '  "nested": {',
      '    "deep": true',
      '  }',
      '}}',
      '[/TOOL_CALL]',
    ].join('\n');
    const result = parseStructuredResponse<{ status: string; plan: string }>(input);
    expect(result).toEqual({ status: 'SUCCESS', plan: 'done' });
  });

  it('should strip [TOOL_CALL] blocks and still handle markdown fences', () => {
    const input = [
      '```json',
      '{"status":"SUCCESS","plan":"test"}',
      '```',
      '[TOOL_CALL]',
      '{tool => "listAgents", args => {}}',
      '[/TOOL_CALL]',
    ].join('\n');
    const result = parseStructuredResponse<{ status: string; plan: string }>(input);
    expect(result).toEqual({ status: 'SUCCESS', plan: 'test' });
  });

  it('should throw on non-JSON with no recoverable content', () => {
    const input = 'This is just plain text with no JSON at all.';
    expect(() => parseStructuredResponse(input)).toThrow(
      'Failed to parse structured response from LLM'
    );
  });

  it('should throw on empty string', () => {
    expect(() => parseStructuredResponse('')).toThrow(
      'Failed to parse structured response from LLM'
    );
  });

  it('should handle the exact pattern from the planner bug', () => {
    // This is the actual pattern that caused the bug:
    // The LLM returns plain text with [TOOL_CALL] blocks because
    // no tools were bound to the model call.
    const input = [
      "I'll gather comprehensive information about the system topology and architecture to provide you with a detailed breakdown.",
      '',
      '[TOOL_CALL]',
      '{tool => "listAgents", args => {',
      '',
      '}}',
      '[/TOOL_CALL]',
      '[TOOL_CALL]',
      '{tool => "inspectTopology", args => {',
      '',
      '}}',
      '[/TOOL_CALL]',
      '[TOOL_CALL]',
      '{tool => "recallKnowledge", args => {',
      '',
      '}}',
      '[/TOOL_CALL]',
    ].join('\n');

    // After stripping [TOOL_CALL] blocks, only the preamble text remains,
    // which is NOT valid JSON. This should throw.
    expect(() => parseStructuredResponse(input)).toThrow(
      'Failed to parse structured response from LLM'
    );
  });
});
