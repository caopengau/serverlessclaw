import { DynamoMemory } from '../lib/memory';
import { ProviderManager } from '../lib/providers/index';
import {
  SSTResource,
  MessageRole,
  AgentType,
  GapStatus,
  ReasoningProfile,
} from '../lib/types/index';
import { sendOutboundMessage } from '../lib/outbound';
import { logger } from '../lib/logger';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Context } from 'aws-lambda';
import {
  extractPayload,
  detectFailure,
  isTaskPaused,
  loadAgentConfig,
  createAgent,
  validatePayload,
  buildProcessOptions,
  emitTaskEvent,
} from '../lib/utils/agent-helpers';

const memory = new DynamoMemory();
const provider = new ProviderManager();
const typedResource = Resource as unknown as SSTResource;

export const CODER_SYSTEM_PROMPT = `
You are the Coder Agent for Serverless Claw. Your role is to implement requested technical changes, write high-quality TypeScript code, and manage AWS infrastructure via SST.

Key Obligations:
1. **Pre-flight Checks**: You MUST call 'validateCode' after every 'fileWrite' or 'multi_replace_file_content' to ensure type safety and linting compliance.
2. **Atomicity**: Ensure the codebase remains in a functional state. Never leave the project in a broken state.
3. **Documentation**: Update relevant 'docs/*.md' and 'INDEX.md' files in the same step as code changes to maintain technical accuracy.
4. **Protected Files**: You are restricted from direct writes to core system files (e.g., sst.config.ts, core/lib/agent.ts). If a change is required, you must describe it and return 'MANUAL_APPROVAL_REQUIRED'.
5. **Pre-Deployment Verification**: Before calling 'triggerDeployment', you MUST verify the changes are correct by:
   - Running 'validateCode' to ensure type safety
   - Running 'runTests' if available to ensure tests pass
   - Reading key files to verify the implementation matches requirements
   Only proceed to 'triggerDeployment' after verification passes.
6. **Deployment**: Trigger a deployment via 'triggerDeployment' only after verifying the build locally with 'validateCode' and 'runTests'.
7. **Clarity**: Explain your technical decisions and follow the project's architecture as defined in 'ARCHITECTURE.md'.
8. **Direct Communication**: Use 'sendMessage' to notify the human user immediately when you start a significant implementation, encounter a blocker, or complete a task. Do not wait for the final response to provide status updates.
`;

interface CoderPayload {
  userId: string;
  task: string;
  metadata?: { gapIds?: string[] };
  traceId?: string;
  sessionId?: string;
  isContinuation?: boolean;
  initiatorId?: string;
  depth?: number;
}

interface CoderEvent {
  detail?: CoderPayload;
  source?: string;
}

/**
 * Coder Agent handler. Processes coding tasks, implements changes,
 * and optionally triggers deployments or notifies QA.
 *
 * @param event - The EventBridge event.
 * @param context - The AWS Lambda context.
 * @returns A promise that resolves to the agent's response string, or undefined on error.
 */
export const handler = async (event: CoderEvent, context: Context): Promise<string | undefined> => {
  logger.info('Coder Agent received task:', JSON.stringify(event, null, 2));

  // EventBridge wraps the payload in 'detail'
  const payload = extractPayload<CoderPayload>(event);
  const { userId, task, metadata, traceId, sessionId, isContinuation, initiatorId, depth } =
    payload;

  if (!validatePayload({ userId, task }, ['userId', 'task'])) {
    return;
  }

  // 1. Transition gaps to PROGRESS
  if (metadata?.gapIds && metadata.gapIds.length > 0) {
    logger.info(`Picking up task. Marking ${metadata.gapIds.length} gaps as PROGRESS.`);
    for (const gapId of metadata.gapIds) {
      await memory.updateGapStatus(gapId, GapStatus.PROGRESS);
    }
  }

  // 2. Process the task
  // 2026 Optimization: Use 'thinking' profile for coding tasks
  const config = await loadAgentConfig(AgentType.CODER);

  const agent = await createAgent('coder', config, memory, provider);
  const response = await agent.process(
    userId,
    task,
    buildProcessOptions({
      profile: ReasoningProfile.THINKING,
      isIsolated: true,
      context,
      isContinuation,
      initiatorId,
      depth,
      traceId,
      sessionId,
    })
  );

  logger.info('Coder Agent completed task:', response);

  // 3. Notify user directly if not a silent internal task
  if (!isTaskPaused(response)) {
    await sendOutboundMessage('coder.agent', userId, response, [userId], sessionId, config.name);
  }

  const isFailure = detectFailure(response);

  // 4. Mark gaps as DONE if successful or map them to a build
  const isSuccess =
    !isFailure &&
    (response.includes('Successfully staged') ||
      response.includes('Neural Core Synthesis') ||
      response.includes('greeting'));

  if (isSuccess && metadata?.gapIds && metadata.gapIds.length > 0) {
    // Check if a deployment was triggered
    const buildMatch = response.match(/Build ID: ([a-zA-Z0-9:-]+)/);
    const buildId = buildMatch ? buildMatch[1] : null;

    if (buildId) {
      logger.info(`Deployment triggered (${buildId}). Mapping gaps to build for monitor.`);
      // 2026 Fix: Use timestamp 0 for fixed lookup compatibility with QA Auditor
      const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
      await db.send(
        new PutCommand({
          TableName: typedResource.MemoryTable.name,
          Item: {
            userId: `BUILD_GAPS#${buildId}`,
            timestamp: 0,
            role: MessageRole.SYSTEM,
            content: JSON.stringify(metadata.gapIds),
          },
        })
      );
    } else {
      logger.info(
        `Task successful without deployment. Marking ${metadata.gapIds.length} gaps as DEPLOYED.`
      );
      for (const gapId of metadata.gapIds) {
        await memory.updateGapStatus(gapId, GapStatus.DEPLOYED);
      }
    }
  }

  // 5. Notify Resumption Loop (Universal Coordination)
  if (!isTaskPaused(response)) {
    await emitTaskEvent({
      source: 'coder.agent',
      agentId: AgentType.CODER,
      userId,
      task,
      response,
      traceId,
      sessionId,
      initiatorId,
      depth,
    });
  }

  return response;
};
