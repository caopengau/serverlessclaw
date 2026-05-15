import { ProviderManager } from '../providers/index';
import { MessageRole, ReasoningProfile } from '../types/index';
import { logger } from '../logger';

export interface EvalRubric {
  name: string;
  description: string;
  scoringCriteria: string;
}

export interface EvalResult {
  score: number; // 0-100
  reasoning: string;
  passed: boolean;
}

/**
 * Uses a high-tier LLM (e.g., Claude 3.5 Sonnet or GPT-4o) to evaluate a trace
 * against a specific rubric. This is the core of the LLM-as-a-judge mechanism.
 */
export class LLMJudge {
  private providerManager: ProviderManager;

  constructor() {
    this.providerManager = new ProviderManager();
  }

  async evaluate(
    traceData: unknown,
    rubric: EvalRubric,
    modelOverride?: string,
    providerOverride?: string
  ): Promise<EvalResult> {
    const prompt = `You are an expert AI judge evaluating the performance of an autonomous agent trace.

Rubric Name: ${rubric.name}
Description: ${rubric.description}
Scoring Criteria:
${rubric.scoringCriteria}

Trace Data:
\`\`\`json
${JSON.stringify(traceData, null, 2)}
\`\`\`

Evaluate the trace based on the rubric. Output your response as a JSON object with the following schema exactly:
{
  "score": <number between 0 and 100>,
  "reasoning": "<your detailed reasoning>",
  "passed": <boolean, true if score >= 80>
}`;

    try {
      const response = await this.providerManager.call(
        [
          {
            role: MessageRole.USER,
            content: prompt,
            traceId: 'eval-run',
            messageId: 'eval-msg-' + Date.now(),
          },
        ],
        undefined,
        ReasoningProfile.FAST, // We can use fast or standard
        modelOverride, // Allow overriding to Claude 3.5 Sonnet or GPT-4o
        providerOverride
      );

      // Parse JSON from response
      const content = typeof response.content === 'string' ? response.content : '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse JSON from LLM judge response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as EvalResult;
      return {
        score: Number(parsed.score),
        reasoning: parsed.reasoning,
        passed: Boolean(parsed.passed),
      };
    } catch (error) {
      logger.error('LLM Judge evaluation failed', { error, rubricName: rubric.name });
      throw error;
    }
  }
}
