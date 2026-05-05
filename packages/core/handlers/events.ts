import { logger } from '../lib/logger';
import { reportHealthIssue } from '../lib/lifecycle/health';
import { Context } from 'aws-lambda';
import { routeToDlq } from './route-to-dlq';
import { checkAndMarkIdempotent } from './events/idempotency';
import { emitMetrics, METRICS } from '../lib/metrics';
import { ConfigManager } from '../lib/registry/config';
import { verifyEventRoutingConfiguration } from '../lib/event-routing';
import { performance } from 'perf_hooks';
import { FlowController } from '../lib/routing/flow-controller';
import { EventType } from '../lib/types/agent/events';
import * as crypto from 'crypto';

import { validateEvent } from './events/validation';
import { checkRecursionLimit } from './events/recursion-guard';
import { getHandlerForEvent } from './events/routing-engine';

// Verify event routing configuration on module load
verifyEventRoutingConfiguration();

export async function handler(
  event: {
    'detail-type': string;
    detail: Record<string, unknown>;
    id?: string;
  },
  context: Context
): Promise<void> {
  const startTime = performance.now();
  const detailType = event['detail-type'];
  const eventDetail = event.detail;
  const envelopeId = event.id;

  // 1. Validation
  const validation = validateEvent(eventDetail);
  if (!validation.valid) {
    const errorMsg = `[VALIDATION] Missing required fields: ${validation.errors?.join(', ')}`;
    logger.error(errorMsg);
    const workspaceId = (eventDetail.workspaceId as string) || undefined;
    await routeToDlq(
      event,
      detailType,
      'SYSTEM',
      (eventDetail.traceId as string) || 'unknown',
      errorMsg,
      (eventDetail.sessionId as string) || 'system-spine',
      workspaceId
    );
    emitMetrics([METRICS.dlqEvents(1, { workspaceId })]).catch(() => {});
    return;
  }

  const traceId = eventDetail.traceId as string;
  const sessionId = eventDetail.sessionId as string;
  const workspaceId = (eventDetail.workspaceId as string) || undefined;
  const scope = { workspaceId };

  // 2. Recursion Guard
  if (detailType !== EventType.DLQ_ROUTE) {
    const limitExceeded = await checkRecursionLimit(
      event,
      detailType,
      eventDetail,
      traceId,
      sessionId,
      workspaceId
    );
    if (limitExceeded) return;
  }

  logger.info(`[EVENTS] Received`, {
    detailType,
    sessionId,
    traceId,
    envelopeId,
    workspaceId: workspaceId || 'GLOBAL',
  });

  emitMetrics([METRICS.eventHandlerInvoked(detailType, scope)]).catch((err) =>
    logger.warn(`Metrics emission failed for ${detailType}:`, err)
  );

  // 3. Flow Control
  const flowResult = await FlowController.canProceed(detailType, workspaceId);
  if (!flowResult.allowed) {
    logger.warn(`[FLOW_CONTROL] ${flowResult.reason} for ${detailType}`);
    await routeToDlq(
      event,
      detailType,
      'SYSTEM',
      traceId,
      flowResult.reason!,
      sessionId,
      workspaceId
    );
    emitMetrics([METRICS.dlqEvents(1, scope)]).catch(() => {});
    return;
  }

  // 4. Idempotency
  const hash = crypto.createHash('sha256');
  const stablePayload = { ...eventDetail };
  delete (stablePayload as Record<string, unknown>).__envelopeId;
  hash.update(JSON.stringify(stablePayload) + detailType);
  const contentHash = hash.digest('hex').substring(0, 16);
  const idempotencyKey = (eventDetail.idempotencyKey as string) || contentHash;

  const alreadyProcessed = await checkAndMarkIdempotent(idempotencyKey, detailType, workspaceId);
  if (alreadyProcessed) {
    logger.info(`[EVENTS] Duplicate event detected: ${idempotencyKey} (${detailType})`);
    return;
  }

  // 5. Retry Guard
  const maxRetryCount = await ConfigManager.getTypedConfig('event_max_retry_count', 3);
  const retryCount = (eventDetail.retryCount as number) ?? 0;
  if (retryCount > maxRetryCount) {
    logger.warn(`[RETRY] Exceeded max retries (${maxRetryCount}) for ${detailType}`);
    await routeToDlq(
      event,
      detailType,
      'SYSTEM',
      traceId,
      'Max retry count exceeded',
      sessionId,
      workspaceId
    );
    emitMetrics([METRICS.dlqEvents(1, scope)]).catch(() => {});
    return;
  }

  // 6. Routing & Dispatch
  try {
    const result = await getHandlerForEvent(event, detailType, traceId, sessionId, workspaceId);
    if (!result) return;

    const { handlerModule, routing } = result;
    const handlerModuleTyped = handlerModule as Record<
      string,
      (event: Record<string, unknown>, contextOrType?: unknown, type?: string) => Promise<void>
    >;

    if (handlerModuleTyped && handlerModuleTyped[routing.function]) {
      if (envelopeId) {
        (eventDetail as Record<string, unknown>).__envelopeId = envelopeId;
      }

      if (routing.passContext) {
        await handlerModuleTyped[routing.function](eventDetail, context, detailType);
      } else {
        await handlerModuleTyped[routing.function](eventDetail, detailType);
      }

      const durationMs = performance.now() - startTime;
      emitMetrics([METRICS.eventHandlerDuration(detailType, durationMs, scope)]).catch((err) =>
        logger.warn(`Metrics emission failed for ${detailType} duration:`, err)
      );
    } else {
      throw new Error(`Handler function ${routing.function} missing in module ${routing.module}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const elapsed = performance.now() - startTime;

    logger.error(`EventHandler failed for ${detailType}: ${errorMessage}`, error);
    await FlowController.recordFailure(detailType, workspaceId);

    await routeToDlq(event, detailType, 'SYSTEM', traceId, errorMessage, sessionId, workspaceId);
    emitMetrics([METRICS.dlqEvents(1, scope)]).catch(() => {});

    emitMetrics([METRICS.eventHandlerErrorDuration(detailType, elapsed, scope)]).catch((err) =>
      logger.warn(`Metrics emission failed for ${detailType} error:`, err)
    );

    await reportHealthIssue({
      component: 'EventHandler',
      issue: `Failed to process event ${detailType}: ${errorMessage}`,
      severity: 'high',
      userId: 'SYSTEM',
      traceId,
      workspaceId,
      context: { detailType, error: errorMessage },
    });

    throw error instanceof Error ? error : new Error(String(error));
  }
}
