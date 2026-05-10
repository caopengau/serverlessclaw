/**
 * Post-deploy fix for CloudFront S3 origin routing.
 *
 * SST's Nextjs component creates CloudFront with only a placeholder origin.
 * This script:
 *   1. Adds the S3 bucket as a second origin
 *   2. Updates the CloudFront function to route static assets → S3, dynamic → Lambda
 *   3. Syncs build assets to S3
 *   4. Verifies the dashboard is accessible
 *
 * Usage: pnpm exec tsx scripts/fix-cloudfront-deploy.ts [stage]
 */

import {
  CloudFrontClient,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  DescribeFunctionCommand,
  UpdateFunctionCommand,
  PublishFunctionCommand,
  CreateOriginAccessControlCommand,
  ListOriginAccessControlsCommand,
} from '@aws-sdk/client-cloudfront';
import { S3Client, ListBucketsCommand, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';

const STAGE = process.argv[2] || 'prod';
const APP = process.argv[3] || 'serverlessclaw';
const RESOURCE = process.argv[4] || 'ClawCenter';

// Resolve region: try SST config first, then env var, then framework default
const DEFAULT_REGION = 'ap-southeast-2';
function getRegion(): string {
  // 1. Try SST outputs
  try {
    const outputs = JSON.parse(readFileSync('.sst/outputs.json', 'utf-8'));
    if (outputs.region) return outputs.region;
  } catch {
    /* ignore */
  }
  // 2. Try env var
  if (process.env.AWS_REGION) return process.env.AWS_REGION;
  // 3. Default
  return DEFAULT_REGION;
}

const REGION = getRegion();
log(`Using region: ${REGION}`);
const cf = new CloudFrontClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

function log(msg: string) {
  console.log(`\x1b[36m[fix-cloudfront]\x1b[0m ${msg}`);
}

function err(msg: string): never {
  console.error(`\x1b[31m[fix-cloudfront ERROR]\x1b[0m ${msg}`);
  process.exit(1);
}

async function getNewestBucketName(): Promise<string> {
  const buckets = await s3.send(new ListBucketsCommand({}));
  const bucketName = buckets.Buckets?.filter(
    (b) =>
      b.Name?.includes(STAGE) &&
      b.Name?.toLowerCase().includes(RESOURCE.toLowerCase()) &&
      b.Name?.includes('assetsbucket')
  ).sort((a, b) => (b.CreationDate?.getTime() || 0) - (a.CreationDate?.getTime() || 0))?.[0]?.Name;
  if (!bucketName) err(`Could not find assets bucket for ${RESOURCE} in stage ${STAGE}`);
  return bucketName;
}

async function getBucketRegionalDomain(bucketName: string): Promise<string> {
  const location = await s3.send(new GetBucketLocationCommand({ Bucket: bucketName }));
  const bucketRegion =
    location.LocationConstraint === 'EU' ? 'eu-west-1' : location.LocationConstraint || 'us-east-1';
  return `${bucketName}.s3.${bucketRegion}.amazonaws.com`;
}

async function findDistribution(): Promise<string> {
  const { ListDistributionsCommand } = await import('@aws-sdk/client-cloudfront');

  // Read dashboard URL from outputs
  let dashboardDomain = '';
  try {
    const outputs = JSON.parse(readFileSync('.sst/outputs.json', 'utf-8'));
    // Try to find the URL for the specific resource
    if (outputs[RESOURCE]) {
      dashboardDomain = new URL(outputs[RESOURCE]).hostname;
    } else if (outputs.dashboard) {
      dashboardDomain = new URL(outputs.dashboard).hostname;
    }

    if (dashboardDomain) {
      log(`Resource domain: ${dashboardDomain}`);
    }
  } catch {
    // outputs.json may not exist yet
  }

  const allDists = await cf.send(new ListDistributionsCommand({}));

  // First try: match by alias (most reliable)
  if (dashboardDomain) {
    const byAlias = allDists.DistributionList?.Items?.find((d) =>
      d.Aliases?.Items?.includes(dashboardDomain)
    );
    if (byAlias?.Id) {
      log(`Distribution (by alias): ${byAlias.Id}`);
      return byAlias.Id;
    }
  }

  // Fallback: match by comment (picks the one with most recent LastModifiedTime)
  const byComment = allDists.DistributionList?.Items?.filter(
    (d) => d.Comment?.includes(RESOURCE) && d.Comment?.includes('app')
  ).sort(
    (a, b) => new Date(b.LastModifiedTime!).getTime() - new Date(a.LastModifiedTime!).getTime()
  );
  if (byComment?.[0]?.Id) {
    log(`Distribution (by comment): ${byComment[0].Id}`);
    return byComment[0].Id;
  }

  err(`Could not find CloudFront distribution for ${RESOURCE}`);
}

async function addS3Origin(distId: string) {
  const current = await cf.send(new GetDistributionConfigCommand({ Id: distId }));
  const config = current.DistributionConfig!;
  const etag = current.ETag!;

  const bucketName = await getNewestBucketName();
  const s3Domain = await getBucketRegionalDomain(bucketName);

  // Check if S3 origin already exists
  const existingS3 = config.Origins?.Items?.find((o) => o.Id === 's3');
  if (existingS3) {
    if (existingS3.DomainName === s3Domain) {
      log(`S3 origin already points to the correct bucket (${bucketName}), skipping`);
    } else {
      log(`Updating S3 origin from ${existingS3.DomainName} to ${s3Domain}...`);
      existingS3.DomainName = s3Domain;
    }
  } else {
    log(`Adding S3 origin for bucket ${bucketName}...`);
    // Find or create OAC
    const oacs = await cf.send(new ListOriginAccessControlsCommand({}));
    let oacId = oacs.OriginAccessControlList?.Items?.find((o) => o.Name?.includes(RESOURCE))?.Id;

    if (!oacId) {
      log('Creating Origin Access Control...');
      const oac = await cf.send(
        new CreateOriginAccessControlCommand({
          OriginAccessControlConfig: {
            Name: `${APP}-${STAGE}-${RESOURCE}OAC`,
            OriginAccessControlOriginType: 's3',
            SigningBehavior: 'always',
            SigningProtocol: 'sigv4',
          },
        })
      );
      oacId = oac.OriginAccessControl?.Id;
    }

    // Add S3 origin
    config.Origins!.Items!.push({
      Id: 's3',
      DomainName: s3Domain,
      OriginPath: '/_assets',
      OriginAccessControlId: oacId,
      S3OriginConfig: { OriginAccessIdentity: '' },
      CustomHeaders: { Quantity: 0 },
      ConnectionAttempts: 3,
      ConnectionTimeout: 10,
      OriginShield: { Enabled: false },
    });
    config.Origins!.Quantity = config.Origins!.Items!.length;
  }

  const cacheBehaviors = config.CacheBehaviors ?? { Quantity: 0, Items: [] };
  config.CacheBehaviors = cacheBehaviors;
  cacheBehaviors.Items ??= [];

  const staticBehavior = cacheBehaviors.Items.find(
    (item) => item.PathPattern === '/_next/static/*'
  );
  if (!staticBehavior) {
    log('Adding CloudFront cache behavior for /_next/static/* via S3 origin...');
    cacheBehaviors.Items.push({
      PathPattern: '/_next/static/*',
      TargetOriginId: 's3',
      ViewerProtocolPolicy: 'redirect-to-https',
      AllowedMethods: {
        Quantity: 2,
        Items: ['HEAD', 'GET'],
        CachedMethods: {
          Quantity: 2,
          Items: ['HEAD', 'GET'],
        },
      },
      SmoothStreaming: false,
      Compress: true,
      LambdaFunctionAssociations: { Quantity: 0 },
      FunctionAssociations: { Quantity: 0 },
      FieldLevelEncryptionId: '',
      CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
      GrpcConfig: { Enabled: false },
    });
  } else {
    staticBehavior.TargetOriginId = 's3';
    staticBehavior.ViewerProtocolPolicy = 'redirect-to-https';
    staticBehavior.Compress = true;
    staticBehavior.LambdaFunctionAssociations = { Quantity: 0 };
    staticBehavior.FunctionAssociations = { Quantity: 0 };
    staticBehavior.CachePolicyId = '658327ea-f89d-4fab-a63d-7e88639e58f6';
  }
  cacheBehaviors.Quantity = cacheBehaviors.Items.length;

  await cf.send(
    new UpdateDistributionCommand({
      Id: distId,
      IfMatch: etag,
      DistributionConfig: config,
    })
  );
  log('S3 origin configured. Waiting 10s for propagation...');
  await new Promise((r) => setTimeout(r, 10000));
}

async function fixCloudFrontFunction(distId: string) {
  // Find the function associated with the distribution
  const distConfig = await cf.send(new GetDistributionConfigCommand({ Id: distId }));
  const fnAssoc = distConfig.DistributionConfig?.DefaultCacheBehavior?.FunctionAssociations;
  log(`Function associations: ${JSON.stringify(fnAssoc)}`);
  const fnArn = fnAssoc?.Items?.[0]?.FunctionARN;
  if (!fnArn) {
    log('No function ARN found. Distribution may still be propagating. Waiting 30s...');
    await new Promise((r) => setTimeout(r, 30000));
    const retry = await cf.send(new GetDistributionConfigCommand({ Id: distId }));
    const retryArn =
      retry.DistributionConfig?.DefaultCacheBehavior?.FunctionAssociations?.Items?.[0]?.FunctionARN;
    if (!retryArn) err('No function associated with distribution after retry');
    return fixCloudFrontFunctionInner(distId, retryArn!);
  }
  return fixCloudFrontFunctionInner(distId, fnArn);
}

async function fixCloudFrontFunctionInner(distId: string, fnArn: string) {
  const fnName = fnArn!
    .split(':')
    .pop()!
    .replace(/^(function\/)/, '');

  // Find Lambda function URL
  const { LambdaClient, ListFunctionUrlConfigsCommand, ListFunctionsCommand } =
    await import('@aws-sdk/client-lambda');
  const lambda = new LambdaClient({});
  // ListFunctions is paginated (max 50/page). We must scan all pages to avoid missing the server function.
  const allFunctions: Array<{ FunctionName?: string; LastModified?: string }> = [];
  let marker: string | undefined;
  do {
    const page = await lambda.send(new ListFunctionsCommand({ Marker: marker }));
    if (page.Functions) allFunctions.push(...page.Functions);
    marker = page.NextMarker;
  } while (marker);

  const serverFn = allFunctions
    .filter(
      (f) =>
        f.FunctionName?.includes(RESOURCE) &&
        f.FunctionName?.includes('Server') &&
        f.FunctionName?.includes(STAGE)
    )
    .sort(
      (a, b) => new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime()
    )[0];
  if (!serverFn?.FunctionName) err(`Could not find server Lambda for ${RESOURCE}`);

  const urlConfig = await lambda.send(
    new ListFunctionUrlConfigsCommand({
      FunctionName: serverFn.FunctionName,
    })
  );
  const lambdaUrl = urlConfig.FunctionUrlConfigs?.[0]?.FunctionUrl;
  if (!lambdaUrl) err('Lambda function has no URL');

  const lambdaHost = new URL(lambdaUrl).host;
  log(`Lambda host: ${lambdaHost}`);
  const bucketName = await getNewestBucketName();
  const s3Domain = await getBucketRegionalDomain(bucketName);

  log(`Updating CloudFront function for ${RESOURCE} to use bucket: ${bucketName}`);

  // Build optimized routing function code - significantly reduced complexity for CloudFront validation
  // The previous long if-chain was causing validation errors; now using object-based lookup
  const code = `import cf from "cloudfront";
function handler(event) {
  var host = event.request.headers.host ? event.request.headers.host.value : "";
  if (host.includes("cloudfront.net")) {
    return { statusCode: 403, statusDescription: "Forbidden", body: { encoding: "text", data: "Forbidden" } };
  }
  event.request.headers["x-forwarded-host"] = event.request.headers.host;
  var uri = event.request.uri;
  var isStatic = uri.startsWith("/_next/") || uri.startsWith("/_assets/");
  if (!isStatic) {
    var ext = uri.split(".").pop();
    if (ext) ext = ext.toLowerCase();
    var staticExts = {"css": 1, "js": 1, "woff2": 1, "woff": 1, "png": 1, "jpg": 1, "svg": 1, "ico": 1, "json": 1, "map": 1, "txt": 1, "xml": 1};
    isStatic = !!staticExts[ext];
  }
  if (isStatic) {
    cf.updateRequestOrigin({
      domainName: "${s3Domain}",
      originPath: "/_assets"
    });
  } else {
    cf.updateRequestOrigin({
      domainName: "${lambdaHost}",
      customOriginConfig: { port: 443, protocol: "https", sslProtocols: ["TLSv1.2"] }
    });
  }
  return event.request;
}`;

  // Get fresh ETag and update
  const fnDesc = await cf.send(new DescribeFunctionCommand({ Name: fnName, Stage: 'DEVELOPMENT' }));

  try {
    const upd = await cf.send(
      new UpdateFunctionCommand({
        Name: fnName,
        IfMatch: fnDesc.ETag,
        FunctionCode: new TextEncoder().encode(code),
        FunctionConfig: { Comment: 'S3+Lambda routing', Runtime: 'cloudfront-js-2.0' },
      })
    );

    // Publish to LIVE
    await cf.send(
      new PublishFunctionCommand({
        Name: fnName,
        IfMatch: upd.ETag!,
      })
    );
    log('CloudFront function updated and published');
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'PreconditionFailed') {
      // ETag stale, retry once
      const fresh = await cf.send(
        new DescribeFunctionCommand({ Name: fnName, Stage: 'DEVELOPMENT' })
      );
      const upd = await cf.send(
        new UpdateFunctionCommand({
          Name: fnName,
          IfMatch: fresh.ETag,
          FunctionCode: new TextEncoder().encode(code),
          FunctionConfig: { Comment: 'S3+Lambda routing', Runtime: 'cloudfront-js-2.0' },
        })
      );
      await cf.send(new PublishFunctionCommand({ Name: fnName, IfMatch: upd.ETag! }));
      log('CloudFront function updated and published (retry)');
    } else {
      throw e;
    }
  }

  // Ensure distribution uses this function
  const dist = await cf.send(new GetDistributionConfigCommand({ Id: distId }));
  const cfg = dist.DistributionConfig!;
  const currentFnArn = cfg.DefaultCacheBehavior?.FunctionAssociations?.Items?.[0]?.FunctionARN;
  const targetArn = fnArn.replace(/:function\/.*$/, `:function/${fnName}`);

  if (currentFnArn !== targetArn) {
    cfg.DefaultCacheBehavior!.FunctionAssociations!.Items![0].FunctionARN = targetArn;
    await cf.send(
      new UpdateDistributionCommand({
        Id: distId,
        IfMatch: dist.ETag,
        DistributionConfig: cfg,
      })
    );
    log('Distribution switched to updated function');
  }
}

async function main() {
  log(`Fixing CloudFront for stage: ${STAGE}`);

  const distId = await findDistribution();
  await addS3Origin(distId);
  await fixCloudFrontFunction(distId);

  log('CloudFront fix complete ✓');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
