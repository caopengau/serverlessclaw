import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMJudge, EvalRubric } from './llm-judge';
import { ProviderManager } from '../providers/index';
import { MessageRole } from '../types/index';

vi.mock('../providers/index');
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('LLMJudge', () => {
  let judge: LLMJudge;
  let mockCall: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCall = vi.fn();
    vi.mocked(ProviderManager).mockImplementation(function (this: any) {
      this.call = mockCall;
      return this;
    } as any);
    judge = new LLMJudge();
  });

  const sampleRubric: EvalRubric = {
    name: 'Test Rubric',
    description: 'A rubric for testing',
    scoringCriteria: 'Score highly if test passes',
  };

  it('should evaluate a trace and parse the result successfully', async () => {
    mockCall.mockResolvedValueOnce({
      role: MessageRole.ASSISTANT,
      content:
        '```json\n{\n  "score": 95,\n  "reasoning": "Excellent performance",\n  "passed": true\n}\n```',
      traceId: 'mock-trace',
    });

    const result = await judge.evaluate({ some: 'data' }, sampleRubric);

    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(result.score).toBe(95);
    expect(result.reasoning).toBe('Excellent performance');
    expect(result.passed).toBe(true);
  });

  it('should throw an error if JSON cannot be parsed from the response', async () => {
    mockCall.mockResolvedValueOnce({
      role: MessageRole.ASSISTANT,
      content: 'This is not JSON at all.',
      traceId: 'mock-trace',
    });

    await expect(judge.evaluate({ some: 'data' }, sampleRubric)).rejects.toThrow(
      'Failed to parse JSON from LLM judge response'
    );
  });

  it('should extract JSON even if there is surrounding text', async () => {
    mockCall.mockResolvedValueOnce({
      role: MessageRole.ASSISTANT,
      content:
        'Here is my evaluation:\n{\n  "score": 50,\n  "reasoning": "Needs improvement",\n  "passed": false\n}\nThank you.',
      traceId: 'mock-trace',
    });

    const result = await judge.evaluate({ some: 'data' }, sampleRubric);

    expect(result.score).toBe(50);
    expect(result.passed).toBe(false);
  });
});
