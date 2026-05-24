import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Resource } from 'sst';
import { logger } from '../logger';
import type { TokenUsageRecord } from '../metrics/token-usage';
import { filterPIIFromObject } from '../utils/pii';
import { TRACE_STATUS } from '../constants';
import { ClawTracer } from './tracer-implementation';

const s3Client = new S3Client({});

/**
 * Evaluates and exports a trace to the S3 Data Lake for fine-tuning.
 * This is part of the SONA Loop (Phase A).
 */
export async function exportToDataLake(
  traceId: string,
  workspaceId?: string,
  tokenUsage?: TokenUsageRecord
): Promise<void> {
  try {
    // 1. Check if DataLakeBucket is configured
    const bucketName = (Resource as unknown as Record<string, { name: string }>).DataLakeBucket
      ?.name;
    if (!bucketName) {
      logger.debug('[DataLake] DataLakeBucket not configured, skipping export.');
      return;
    }

    // 2. Fetch full trace
    const traceNodes = await ClawTracer.getTrace(traceId, workspaceId);
    if (!traceNodes || traceNodes.length === 0) {
      logger.debug(`[DataLake] Trace ${traceId} not found, skipping.`);
      return;
    }

    // Usually the root node contains the final response and status
    const rootNode = traceNodes.find((n) => n.nodeId === 'root') || traceNodes[0];

    // 3. Quality Filtering
    if (rootNode.status !== TRACE_STATUS.COMPLETED) {
      return; // Only export fully completed traces
    }

    if (rootNode.failureReason) {
      return; // Skip traces with errors
    }

    // Token budget threshold (e.g., must be under 50k tokens to be considered "efficient")
    if (tokenUsage && tokenUsage.totalTokens > 50000) {
      return;
    }

    // 4. Sanitize and decouple from workspace/tenant
    const sanitizedTraceNodes = traceNodes.map((node) => {
      const sanitized = filterPIIFromObject({
        ...node,
        workspaceId: undefined,
        orgId: undefined,
        teamId: undefined,
        staffId: undefined,
        userId: 'ANONYMIZED',
      });
      return sanitized;
    });

    const dataLakeRecord = {
      version: '1.0',
      exportedAt: Date.now(),
      traceId: traceId,
      agentId: rootNode.agentId || 'unknown',
      nodes: sanitizedTraceNodes,
      tokenUsage: tokenUsage ? filterPIIFromObject(tokenUsage) : undefined,
    };

    // JSONL format (one line)
    const jsonlData = JSON.stringify(dataLakeRecord) + '\n';

    // File key: tuning-traces/YYYY-MM-DD/agentId/traceId.jsonl
    const date = new Date().toISOString().split('T')[0];
    const key = `tuning-traces/${date}/${dataLakeRecord.agentId}/${traceId}.jsonl`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: jsonlData,
        ContentType: 'application/jsonlines',
      })
    );

    logger.info(`[DataLake] Successfully exported trace ${traceId} to Data Lake.`);
  } catch (error) {
    logger.warn(`[DataLake] Failed to export trace ${traceId}:`, error);
  }
}
