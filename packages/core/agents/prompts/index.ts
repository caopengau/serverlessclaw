import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

const readPrompt = (filename: string) => {
  const candidates = [
    path.join(currentDir, filename),
    path.join(process.cwd(), 'packages/core/agents/prompts', filename),
    path.join(process.cwd(), 'framework/packages/core/agents/prompts', filename),
    // OpenNext standalone path
    path.join(process.cwd(), 'apps/dashboard/packages/core/agents/prompts', filename),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf-8');
      }
    } catch {
      // Continue to next candidate
    }
  }

  console.error(`[Prompts] Failed to read prompt file: ${filename}. Searched in ${candidates.length} locations.`);
  return '';
};

export const SUPERCLAW_SYSTEM_PROMPT = readPrompt('superclaw.md');
export const CODER_SYSTEM_PROMPT = readPrompt('coder.md');
export const PLANNER_SYSTEM_PROMPT = readPrompt('planner.md');
export const REFLECTOR_SYSTEM_PROMPT = readPrompt('reflector.md');
export const QA_SYSTEM_PROMPT = readPrompt('qa.md');
export const CRITIC_SYSTEM_PROMPT = readPrompt('critic.md');
export const FACILITATOR_SYSTEM_PROMPT = readPrompt('facilitator.md');
export const MERGER_SYSTEM_PROMPT = readPrompt('merger.md');
export const RESEARCHER_SYSTEM_PROMPT = readPrompt('researcher.md');
export const JUDGE_SYSTEM_PROMPT = readPrompt('judge.md');
