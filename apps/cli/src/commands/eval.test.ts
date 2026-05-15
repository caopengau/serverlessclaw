import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runEval } from './eval';
import { LLMJudge } from '@serverlessclaw/core/lib/evals/llm-judge';
import fs from 'fs/promises';

vi.mock('@serverlessclaw/core/lib/evals/llm-judge');

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
  };
});

describe('CLI: claw eval', () => {
  let mockEvaluate: any;
  let exitSpy: any;
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluate = vi.fn();
    vi.mocked(LLMJudge).mockImplementation(function (this: any) {
      this.evaluate = mockEvaluate;
      return this;
    } as any);

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ traceId: 'test-trace' }));

    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    if (exitSpy) exitSpy.mockRestore();
    if (consoleSpy) consoleSpy.mockRestore();
  });
  it('should run successfully when evaluation passes', async () => {
    mockEvaluate.mockResolvedValueOnce({
      score: 100,
      reasoning: 'Perfect',
      passed: true,
    });

    await expect(runEval({ suite: 'test-suite' })).resolves.not.toThrow();

    expect(mockEvaluate).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('PASSED'));
  });

  it('should exit with 1 when evaluation fails', async () => {
    mockEvaluate.mockResolvedValueOnce({
      score: 40,
      reasoning: 'Bad',
      passed: false,
    });

    await expect(runEval({ suite: 'test-suite' })).rejects.toThrow('process.exit called');

    expect(mockEvaluate).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('FAILED'));
  });

  it('should output JSON when requested', async () => {
    mockEvaluate.mockResolvedValueOnce({
      score: 100,
      reasoning: 'Perfect',
      passed: true,
    });

    await runEval({ suite: 'test-suite', json: true });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/"suite": "test-suite"/));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/"score": 100/));
  });
});
