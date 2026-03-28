/**
 * Utility for adding trace steps from event handlers without requiring
 * a full ClawTracer instance. Useful for instrumenting agent-to-agent
 * communication patterns.
 */

import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import type { SSTResource } from '../types/system';
import { TraceType } from '../types/constants';
import { getDocClient } from './ddb-client';

// Removed local doc client management in favor of shared utility

interface TraceStepInput {
  type: TraceType;
  content: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Adds a trace step to an existing trace node.
 * Use this from event handlers to instrument agent-to-agent communication.
 *
 * @param traceId - The trace ID to add the step to.
 * @param nodeId - The node ID within the trace (defaults to 'root').
 * @param step - The step to add.
 */
export async function addTraceStep(
  traceId: string | undefined,
  nodeId: string | undefined,
  step: TraceStepInput
): Promise<void> {
  if (!traceId) {
    logger.info('No traceId provided, skipping trace step');
    return;
  }

  const typedResource = Resource as unknown as SSTResource;
  const tableName = typedResource.TraceTable?.name;
  if (!tableName) {
    logger.warn('TraceTable name is missing, cannot add trace step');
    return;
  }

  const fullStep = {
    ...step,
    stepId: uuidv4(),
    timestamp: Date.now(),
  };

  try {
    const client = getDocClient();
    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { traceId, nodeId: nodeId ?? 'root' },
        UpdateExpression: 'SET #steps = list_append(if_not_exists(#steps, :empty_list), :step)',
        ExpressionAttributeNames: { '#steps': 'steps' },
        ExpressionAttributeValues: {
          ':step': [fullStep],
          ':empty_list': [],
        },
      })
    );
  } catch (e) {
    logger.warn(`Failed to add trace step to ${traceId}/${nodeId ?? 'root'}:`, e);
  }
}

/**
 * Updates the metadata of a trace node.
 *
 * @param traceId - The trace ID.
 * @param nodeId - The node ID within the trace.
 * @param metadata - The metadata to merge into the node.
 */
export async function updateTraceMetadata(
  traceId: string | undefined,
  nodeId: string | undefined,
  metadata: Record<string, unknown>
): Promise<void> {
  if (!traceId) return;

  const typedResource = Resource as unknown as SSTResource;
  const tableName = typedResource.TraceTable?.name;
  if (!tableName) return;

  try {
    const client = getDocClient();
    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { traceId, nodeId: nodeId ?? 'root' },
        UpdateExpression: 'SET metadata = if_not_exists(metadata, :empty) || :meta',
        ExpressionAttributeValues: {
          ':meta': metadata,
          ':empty': {},
        },
      })
    );
  } catch (e) {
    logger.warn(`Failed to update trace metadata for ${traceId}/${nodeId ?? 'root'}:`, e);
  }
}

/**
 * Updates the status of a trace node.
 *
 * @param traceId - The trace ID.
 * @param nodeId - The node ID within the trace.
 * @param status - The new status.
 */
export async function updateTraceStatus(
  traceId: string | undefined,
  nodeId: string | undefined,
  status: string
): Promise<void> {
  if (!traceId) return;

  const typedResource = Resource as unknown as SSTResource;
  const tableName = typedResource.TraceTable?.name;
  if (!tableName) return;

  try {
    const client = getDocClient();
    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { traceId, nodeId: nodeId ?? 'root' },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
      })
    );
  } catch (e) {
    logger.warn(`Failed to update trace status for ${traceId}/${nodeId ?? 'root'}:`, e);
  }
}
