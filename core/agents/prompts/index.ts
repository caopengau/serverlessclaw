import fs from 'fs';
import path from 'path';

/**
 * Loads a prompt from a markdown file in the same directory.
 * Synchronous read is preferred for Lambda initialization performance.
 */
function loadPrompt(fileName: string): string {
  try {
    const filePath = path.join(__dirname, fileName);
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch (error) {
    console.error(`Failed to load prompt from ${fileName}:`, error);
    return 'Failed to load system prompt.';
  }
}

export const SUPERCLAW_SYSTEM_PROMPT = loadPrompt('superclaw.md');
export const CODER_SYSTEM_PROMPT = loadPrompt('coder.md');
export const PLANNER_SYSTEM_PROMPT = loadPrompt('planner.md');
export const REFLECTOR_SYSTEM_PROMPT = loadPrompt('reflector.md');
export const QA_SYSTEM_PROMPT = loadPrompt('qa.md');
