import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Static imports of markdown files so esbuild (SST) compiles them inline.
import superclawPrompt from './superclaw.md';
import coderPrompt from './coder.md';
import plannerPrompt from './planner.md';
import reflectorPrompt from './reflector.md';
import qaPrompt from './qa.md';
import criticPrompt from './critic.md';
import facilitatorPrompt from './facilitator.md';
import mergerPrompt from './merger.md';
import researcherPrompt from './researcher.md';
import judgePrompt from './judge.md';

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

  console.error(
    `[Prompts] Failed to read prompt file: ${filename}. Searched in ${candidates.length} locations.`
  );
  return '';
};

const resolvePrompt = (importedValue: unknown, filename: string): string => {
  const val = typeof importedValue === 'string' ? importedValue : '';
  if (!val || (val.startsWith('/') && val.endsWith('.md')) || val.length < 100) {
    return readPrompt(filename);
  }
  return val;
};

export const SUPERCLAW_SYSTEM_PROMPT = resolvePrompt(superclawPrompt, 'superclaw.md');
export const CODER_SYSTEM_PROMPT = resolvePrompt(coderPrompt, 'coder.md');
export const PLANNER_SYSTEM_PROMPT = resolvePrompt(plannerPrompt, 'planner.md');
export const REFLECTOR_SYSTEM_PROMPT = resolvePrompt(reflectorPrompt, 'reflector.md');
export const QA_SYSTEM_PROMPT = resolvePrompt(qaPrompt, 'qa.md');
export const CRITIC_SYSTEM_PROMPT = resolvePrompt(criticPrompt, 'critic.md');
export const FACILITATOR_SYSTEM_PROMPT = resolvePrompt(facilitatorPrompt, 'facilitator.md');
export const MERGER_SYSTEM_PROMPT = resolvePrompt(mergerPrompt, 'merger.md');
export const RESEARCHER_SYSTEM_PROMPT = resolvePrompt(researcherPrompt, 'researcher.md');
export const JUDGE_SYSTEM_PROMPT = resolvePrompt(judgePrompt, 'judge.md');
