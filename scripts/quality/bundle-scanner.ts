import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Bundle Scanner: Verifies OpenNext build artifacts for critical modules.
 * This is a quality gate to prevent 500 Internal Server Errors in Lambda.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Bundle Scanner: Verifies OpenNext build artifacts for critical modules.
 * This is a quality gate to prevent 500 Internal Server Errors in Lambda.
 */

const APPS_ROOT = 'framework/apps';

function log(msg: string) {
  console.log(`\x1b[35m[bundle-scanner]\x1b[0m ${msg}`);
}

function warn(msg: string) {
  console.log(`\x1b[33m[bundle-scanner WARNING]\x1b[0m ${msg}`);
}

function err(msg: string): never {
  console.error(`\x1b[31m[bundle-scanner ERROR]\x1b[0m ${msg}`);
  process.exit(1);
}

async function scanApp(appPath: string) {
  log(`Scanning app build: ${appPath}`);

  const openNextPath = join(appPath, '.open-next');
  if (!existsSync(openNextPath)) {
    warn(`No .open-next folder found at ${appPath}. Skipping check.`);
    return;
  }

  // 1. Check for critical runtime dependencies (Next.js)
  // We look for 'next' package in the bundled node_modules
  // Note: OpenNext v4 may nest node_modules inside server-functions/default
  const serverFunctionsPath = join(openNextPath, 'server-functions');
  if (!existsSync(serverFunctionsPath)) {
    warn(`No server-functions found in ${openNextPath}. Skipping.`);
    return;
  }

  const serverDirs = readdirSync(serverFunctionsPath);
  for (const serverDir of serverDirs) {
    // Skip non-function directories (e.g., 'node_modules' is OpenNext internal structure)
    if (serverDir === 'node_modules' || serverDir === 'assets' || serverDir.startsWith('.')) {
      log(`Skipping internal directory [${serverDir}]`);
      continue;
    }

    const serverPath = join(serverFunctionsPath, serverDir);
    const bundleNodeModules = join(serverPath, 'node_modules');
    const bundlePnpmNodeModules = join(serverPath, 'node_modules', '.pnpm');

    log(`Verifying runtime dependencies in [${serverDir}] bundle...`);

    const hasNext =
      existsSync(join(bundleNodeModules, 'next')) ||
      (existsSync(bundlePnpmNodeModules) &&
        execSync(`find "${bundlePnpmNodeModules}" -name "next" -type d 2>/dev/null`).toString()
          .length > 0);

    if (!hasNext) {
      err(`Critical module 'next' is missing from the [${serverDir}] server function bundle!
This will cause a 500 Internal Server Error (ERR_MODULE_NOT_FOUND) in Lambda.
Likely cause: Monorepo tracing root issues or nested pnpm-workspace.yaml conflict.`);
    }

    log(`✅ Bundle [${serverDir}] contains Next.js runtime.`);
  }

  // 2. Check for standalone structure consistency
  const standalonePath = join(appPath, '.next', 'standalone');
  if (existsSync(standalonePath)) {
    const pkgJsonPath = join(standalonePath, 'package.json');
    if (existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      if (!pkg.dependencies?.next && !pkg.devDependencies?.next) {
        warn(
          'Next.js is not listed in standalone package.json. This might be okay if bundled, but check logs.'
        );
      }
    }
  }
}

async function main() {
  if (!existsSync(APPS_ROOT)) {
    log('No apps directory found. Nothing to scan.');
    return;
  }

  const apps = readdirSync(APPS_ROOT, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => join(APPS_ROOT, dirent.name));

  for (const app of apps) {
    await scanApp(app);
  }
  log('All critical bundles verified ✓');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
