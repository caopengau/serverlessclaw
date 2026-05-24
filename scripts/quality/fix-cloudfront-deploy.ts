import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const SST_PLATFORM_DIR = path.join(ROOT_DIR, '.sst/platform');

// Check if .sst/platform exists, if not, bootstrap it using sst install
function ensureSstPlatform() {
  if (!fs.existsSync(SST_PLATFORM_DIR)) {
    console.log('▶ .sst/platform directory not found. Bootstrapping SST providers...');
    try {
      execSync('npx sst install', { cwd: ROOT_DIR, stdio: 'inherit' });
      console.log('✔ SST providers installed successfully.');
    } catch (error) {
      console.error('❌ Failed to run npx sst install:', error);
      process.exit(1);
    }
  } else {
    console.log('✔ .sst/platform directory found.');
  }
}

// Find all files matching a pattern recursively
function findFilesRecursively(dir: string, fileRegex: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
<<<<<<< HEAD
    if (file === 'node_modules') continue; // Skip node_modules to avoid log spam and speed up scan

    if (file === 'node_modules' || file === '.git') continue;
=======
    // Skip node_modules and hidden git directory
    if (file === 'node_modules' || file === '.git') continue;

>>>>>>> f8934c59bab33060336d087f4734296ba7f9f5ed
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results.push(...findFilesRecursively(filePath, fileRegex));
    } else if (fileRegex.test(file)) {
      results.push(filePath);
    }
  }
  return results;
}

// Patch specific file config
function patchFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');

  // Regex to match customOriginConfig followed by originAccessControlConfig:{enabled:false/!1}
  // Handles variable spaces, quotes, and minified formats.
  const regex =
    /customOriginConfig:\s*\{\s*port:\s*443,\s*protocol:\s*["']https["'],\s*sslProtocols:\s*\[\s*["']TLSv1\.2["']\s*\]\s*,?\s*\},\s*originAccessControlConfig:\s*\{\s*enabled:\s*(?:false|!1),?\s*\}/g;

  if (regex.test(content)) {
    console.log(`▶ Patching file: ${path.relative(ROOT_DIR, filePath)}`);
    const patchedContent = content.replace(
      regex,
      `customOriginConfig: {
      port: 443,
      protocol: "https",
      sslProtocols: ["TLSv1.2"],
    }`
    );
    fs.writeFileSync(filePath, patchedContent, 'utf8');
    console.log(`✔ Patched ${path.relative(ROOT_DIR, filePath)} successfully.`);
  }
}

function main() {
  console.log('=== Starting CloudFront Origin Access Control Patch ===');
  ensureSstPlatform();

  // 1. Patch router.ts template
  const routerPath = path.join(SST_PLATFORM_DIR, 'src/components/aws/router.ts');
  if (fs.existsSync(routerPath)) {
    patchFile(routerPath);
  } else {
    console.warn(`⚠ Warning: router.ts not found at ${routerPath}`);
  }

  // 2. Patch any generated .mjs config files
  console.log('Searching for generated config and bundled JS/MJS files in .sst/platform...');
  const compiledFiles = findFilesRecursively(SST_PLATFORM_DIR, /\.(?:mjs|js|ts)$/);
  console.log(`Found ${compiledFiles.length} files to inspect.`);
  for (const file of compiledFiles) {
    if (file !== routerPath) {
      patchFile(file);
    }
  }

  console.log('=== CloudFront OAC Patch Completed ===\n');
}

main();
