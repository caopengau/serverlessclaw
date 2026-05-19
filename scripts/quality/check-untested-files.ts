#!/usr/bin/env tsx
/**
 * Untested File Detector
 *
 * Identifies new/modified source files that lack corresponding test files.
 * Issues a warning to remind agents/developers to add tests.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

function getStagedFiles(): string[] {
  try {
    return execSync('git diff --cached --name-only', { encoding: 'utf-8' })
      .split('\n')
      .filter((f) => f.trim() !== '');
  } catch {
    return [];
  }
}

function checkUntested() {
  const files = getStagedFiles();
  const sourceFiles = files.filter((f) => {
    return (
      (f.startsWith('packages/') || f.startsWith('apps/')) &&
      (f.endsWith('.ts') || f.endsWith('.tsx')) &&
      !f.includes('.test.') &&
      !f.includes('.d.ts') &&
      !f.includes('index.ts')
    );
  });

  const missingTests: string[] = [];

  for (const file of sourceFiles) {
    const dir = dirname(file);
    const ext = extname(file);
    const base = basename(file, ext);

    const testFile = join(dir, `${base}.test${ext}`);
    const specFile = join(dir, `${base}.spec${ext}`);

    if (!existsSync(testFile) && !existsSync(specFile)) {
      missingTests.push(file);
    }
  }

  if (missingTests.length > 0) {
    console.log('\x1b[33m%s\x1b[0m', '\n⚠️  Untested Source Files Detected:');
    missingTests.forEach((f) => console.log(`   - ${f}`));
    console.log(
      '\x1b[33m%s\x1b[0m',
      '\n[AI-GUARD] Please ensure new features have corresponding unit tests.\n'
    );
  } else if (sourceFiles.length > 0) {
    console.log('\x1b[32m%s\x1b[0m', '✅ All staged source files have corresponding tests.');
  }
}

checkUntested();
