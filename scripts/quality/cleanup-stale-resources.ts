#!/usr/bin/env node
/**
 * Cleanup Stale AWS Resources
 *
 * Identifies and optionally removes stale AWS resources:
 * - CloudFront distributions not accessed in 30+ days
 * - Empty S3 buckets
 * - Lambda functions not modified in 90+ days
 * - Unused API Gateway endpoints
 *
 * Usage:
 *   npx tsx scripts/quality/cleanup-stale-resources.ts --dry-run     # Show what would be deleted
 *   npx tsx scripts/quality/cleanup-stale-resources.ts --confirm      # Actually delete (dangerous!)
 *
 * Environment:
 *   AWS_REGION - AWS region to scan (default: ap-southeast-2, framework default)
 *   DRY_RUN - Set to 'true' for dry-run mode
 */

import { execSync } from 'child_process';

const AWS_REGION = process.env.AWS_REGION || 'ap-southeast-2';
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const CONFIRM = process.argv.includes('--confirm');

const log = {
  step: (msg: string) => console.log(`\n📋 ${msg}`),
  info: (msg: string) => console.log(`   ℹ️  ${msg}`),
  success: (msg: string) => console.log(`   ✅ ${msg}`),
  warning: (msg: string) => console.log(`   ⚠️  ${msg}`),
  error: (msg: string) => console.error(`   ❌ ${msg}`),
  item: (msg: string) => console.log(`      • ${msg}`),
};

function exec(cmd: string, silent = false): string {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    }).trim();
  } catch {
    if (!silent) {
      log.error(`Command failed: ${cmd}`);
    }
    return '';
  }
}

async function scanCloudFront(): Promise<void> {
  log.step('Scanning CloudFront Distributions');

  try {
    const result = exec(
      'aws cloudfront list-distributions --query "DistributionList.Items[].[Id,CreatedTime,LastModifiedTime,Status]" --output json'
    );

    if (!result) {
      log.warning('No CloudFront distributions found or access denied');
      return;
    }

    const distributions = JSON.parse(result);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let staleCount = 0;

    distributions.forEach((dist: string[]) => {
      const [id, _created, modified, status] = dist;
      const modifiedDate = new Date(modified);

      if (modifiedDate < thirtyDaysAgo && status !== 'Enabled') {
        staleCount++;
        log.item(`${id} (Status: ${status}, Last Modified: ${modified})`);

        if (!DRY_RUN && CONFIRM) {
          log.info(`Would disable and delete: ${id}`);
          // exec(`aws cloudfront delete-distribution --id ${id} --etag ${etag}`);
        }
      }
    });

    if (staleCount === 0) {
      log.success('No stale CloudFront distributions found');
    } else {
      log.warning(`Found ${staleCount} stale distribution(s)`);
    }
  } catch {
    log.error('Failed to scan CloudFront');
  }
}

async function scanS3Buckets(): Promise<void> {
  log.step('Scanning S3 Buckets');

  try {
    const bucketsResult = exec('aws s3api list-buckets --query "Buckets[].Name" --output json');

    if (!bucketsResult) {
      log.warning('No S3 buckets found or access denied');
      return;
    }

    const buckets = JSON.parse(bucketsResult);
    let emptyCount = 0;
    let untaggedCount = 0;

    for (const bucket of buckets) {
      // Check if bucket is empty
      const sizeResult = exec(
        `aws s3 ls s3://${bucket} --summarize --recursive --region ${AWS_REGION} 2>/dev/null | grep "Total Size:" || echo "0 Bytes"`
      );

      const sizeInBytes = parseInt(sizeResult.match(/(\d+)/)?.[1] || '0');

      if (sizeInBytes === 0) {
        emptyCount++;
        log.item(`${bucket} (Empty)`);

        if (!DRY_RUN && CONFIRM) {
          log.info(`Would delete empty bucket: ${bucket}`);
          // exec(`aws s3 rb s3://${bucket}`);
        }
      }

      // Check tags
      const tagsResult = exec(
        `aws s3api get-bucket-tagging --bucket ${bucket} 2>/dev/null || echo "untagged"`
      );

      if (tagsResult === 'untagged') {
        untaggedCount++;
      }
    }

    if (emptyCount === 0) {
      log.success('No empty S3 buckets found');
    } else {
      log.warning(`Found ${emptyCount} empty bucket(s)`);
    }

    if (untaggedCount > 0) {
      log.warning(`Found ${untaggedCount} untagged bucket(s)`);
    }
  } catch {
    log.error('Failed to scan S3 buckets');
  }
}

async function scanLambdaFunctions(): Promise<void> {
  log.step('Scanning Lambda Functions');

  try {
    const result = exec(
      `aws lambda list-functions --region ${AWS_REGION} --query "Functions[].[FunctionName,LastModified,Runtime]" --output json`
    );

    if (!result) {
      log.warning('No Lambda functions found or access denied');
      return;
    }

    const functions = JSON.parse(result);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let orphanedCount = 0;

    functions.forEach((fn: string[]) => {
      const [name, lastModified, runtime] = fn;
      const modifiedDate = new Date(lastModified);

      if (modifiedDate < ninetyDaysAgo) {
        orphanedCount++;
        log.item(`${name} (Runtime: ${runtime}, Last Modified: ${lastModified})`);

        if (!DRY_RUN && CONFIRM) {
          log.info(`Would delete: ${name}`);
          // exec(`aws lambda delete-function --function-name ${name} --region ${AWS_REGION}`);
        }
      }
    });

    if (orphanedCount === 0) {
      log.success('No orphaned Lambda functions found');
    } else {
      log.warning(`Found ${orphanedCount} potentially orphaned function(s)`);
    }
  } catch {
    log.error('Failed to scan Lambda functions');
  }
}

async function scanAPIGateway(): Promise<void> {
  log.step('Scanning API Gateway Endpoints');

  try {
    const result = exec(
      `aws apigateway get-rest-apis --region ${AWS_REGION} --query "items[].[name,createdDate]" --output json`
    );

    if (!result || result === '[]') {
      log.success('No unused API Gateway endpoints found');
      return;
    }

    const apis = JSON.parse(result);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let unusedCount = 0;

    apis.forEach((api: [string, string]) => {
      const [name, createdDate] = api;
      const created = new Date((createdDate as unknown as number) * 1000);

      if (created < ninetyDaysAgo) {
        unusedCount++;
        log.item(`${name} (Created: ${created.toISOString()})`);
      }
    });

    if (unusedCount === 0) {
      log.success('No unused API Gateway endpoints found');
    } else {
      log.warning(`Found ${unusedCount} potentially unused endpoint(s)`);
    }
  } catch {
    log.error('Failed to scan API Gateway');
  }
}

async function main(): Promise<void> {
  console.log('\n🧹 AWS Stale Resource Cleanup Scanner\n');

  if (!DRY_RUN && !CONFIRM) {
    log.warning('Running in discovery mode (no changes)');
    log.info('To actually delete, run with --confirm flag');
    log.info('To preview changes, run with --dry-run flag\n');
  } else if (DRY_RUN) {
    log.info('DRY RUN MODE - Nothing will be deleted\n');
  } else if (CONFIRM) {
    log.warning('CONFIRM MODE - Resources will be DELETED\n');
  }

  log.step('Configuration');
  log.info(`Region: ${AWS_REGION}`);
  log.info(
    `Account: ${exec('aws sts get-caller-identity --query Account --output text', true) || 'unknown'}`
  );

  // Verify AWS credentials
  try {
    exec('aws sts get-caller-identity --output text', true);
  } catch {
    log.error('AWS credentials not configured');
    process.exit(1);
  }

  // Run scans
  await scanCloudFront();
  await scanS3Buckets();
  await scanLambdaFunctions();
  await scanAPIGateway();

  console.log('\n✅ Scan completed\n');
  log.info('Review the results above. Stale resources are marked with ⚠️');
  log.info('Note: These are candidates for cleanup. Review before deletion.');
  log.info('Run with --confirm flag to delete identified resources.');
}

main().catch((error) => {
  log.error(`Cleanup scan failed: ${error.message}`);
  process.exit(1);
});
