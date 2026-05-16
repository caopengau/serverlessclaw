import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

const readPrompt = (filename: string) => {
  try {
    return fs.readFileSync(path.join(_dirname, filename), 'utf-8');
  } catch (err) {
    console.error(`Failed to read prompt file: ${filename}`, err);
    return '';
  }
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
