import {
  IMemory,
  IProvider,
  IAgentConfig,
  ReasoningProfile,
  InsightCategory,
  AttachmentType,
  Message,
} from '../types/index';
import { SYSTEM, LIMITS } from '../constants';
import { AgentContext } from './context';
import { ContextManager } from './context-manager';
import { resolvePromptSnippets } from '../prompts/snippets';
import { logger } from '../logger';
import { generateId, generateMessageId } from '../utils/id-generator';

export interface ContextResult {
  contextPrompt: string;
  messages: Message[];
  summary: string | null;
  contextLimit: number;
  activeModel: string;
  activeProvider: string;
}

export class AgentAssembler {
  private static async retrieveMemoryState(
    memory: IMemory,
    baseUserId: string,
    storageId: string,
    agentId: string,
    scope: any
  ) {
    const { NegativeMemory } = await import('../memory/negative-memory');
    const negMemory = new NegativeMemory(memory);

    const [history, [distilled, lessons, prefPrefixed, prefRaw, globalLessons, negativeContext]] =
      await Promise.all([
        memory.getHistory(storageId),
        Promise.all([
          memory.getDistilledMemory(baseUserId),
          memory.getLessons(baseUserId),
          memory.searchInsights(`USER#${baseUserId}`, '*', InsightCategory.USER_PREFERENCE, 50),
          memory.searchInsights(baseUserId, '*', InsightCategory.USER_PREFERENCE, 50),
          memory.getGlobalLessons(5),
          negMemory.getNegativeContext(agentId, scope),
        ]),
      ]);

    const preferences = {
      items: [...(prefPrefixed.items ?? []), ...(prefRaw.items ?? [])],
    };

    let recoveryContext = '';
    try {
      const [{ AGENT_LOG_MESSAGES }, recoveryData] = await Promise.all([
        import('./executor'),
        memory.getDistilledMemory(SYSTEM.RECOVERY_KEY),
      ]);
      if (recoveryData) {
        recoveryContext = `${AGENT_LOG_MESSAGES.RECOVERY_LOG_PREFIX}${recoveryData}`;
        await memory.updateDistilledMemory(SYSTEM.RECOVERY_KEY, '');
      }
    } catch {
      // Silently ignore
    }

    return { history, distilled, lessons, preferences, globalLessons, negativeContext, recoveryContext };
  }

  private static async buildContextPrompt(
    provider: IProvider,
    config: IAgentConfig | undefined,
    memoryState: any,
    options: any
  ) {
    const {
      isIsolated, depth, activeModel, activeProvider, activeProfile, systemPrompt, pageContext
    } = options;
    const { distilled, lessons, preferences, globalLessons, negativeContext, recoveryContext } = memoryState;

    const facts = [
      ...distilled.split('\n').filter(Boolean),
      ...(preferences.items?.map((i: any) => i.content) ?? []),
    ].join('\n');

    const pageContextBlock = pageContext
      ? `\n\n[CURRENT_PAGE_CONTEXT]:\nThe user is currently interacting with this dashboard page. Use this to provide context-aware assistance.\nURL: ${pageContext.url}${pageContext.title ? `\nTitle: ${pageContext.title}` : ''}${pageContext.traceId ? `\nActive Trace ID: ${pageContext.traceId}` : ''}${pageContext.sessionId ? `\nActive Session ID: ${pageContext.sessionId}` : ''}${pageContext.agentId ? `\nActive Agent ID: ${pageContext.agentId}` : ''}${pageContext.data ? `\nPage Data: ${JSON.stringify(pageContext.data)}` : ''}\n`
      : '';

    const globalLessonsBlock =
      globalLessons.length > 0
        ? `\n\n[COLLECTIVE_SWARM_INTELLIGENCE]:\nThese are system-wide lessons learned across ALL sessions. Apply them universally:\n${globalLessons.map((l: string) => `- ${l}`).join('\n')}\n`
        : '';

    const [capabilities, resolvedPrompt] = await Promise.all([
      provider.getCapabilities(activeModel),
      resolvePromptSnippets(systemPrompt),
    ]);

    let contextPrompt = resolvedPrompt;

    if (capabilities.supportedAttachmentTypes?.includes(AttachmentType.IMAGE)) {
      const { VISION_PROMPT_BLOCK } = await import('../prompts/vision');
      contextPrompt += VISION_PROMPT_BLOCK;
    }

    if (recoveryContext) contextPrompt += recoveryContext;
    contextPrompt += pageContextBlock;
    contextPrompt += `\n\n${AgentContext.getMemoryIndexBlock(distilled, lessons.length, preferences.items.length)}`;
    contextPrompt += `\n\n[INTELLIGENCE]\n${facts.length > 0 ? facts : 'No persistent knowledge available for this user yet.'}\n\n`;
    contextPrompt += globalLessonsBlock;
    if (negativeContext) contextPrompt += negativeContext;

    const { SystemContext } = await import('../utils/system-context');
    contextPrompt += SystemContext.getEnvironmentalConstraints();

    contextPrompt += `\n\n${AgentContext.getIdentityBlock(
      config,
      activeModel,
      activeProvider,
      activeProfile,
      depth
    )}`;

    contextPrompt += `
      [RELATIONSHIP_CONTEXT]:
      - MODE: ${isIsolated ? 'SYSTEM_TASK' : 'USER_CONSULTATION'}
      - AUDIENCE: ${isIsolated ? 'Orchestrator' : 'Human User'}
      - BEHAVIOR: ${isIsolated ? 'Be technical, precise, and structured.' : 'Be friendly, direct, and conversational. Skip internal monologue.'}
      `;

    return { contextPrompt, contextLimit: capabilities.contextWindow ?? LIMITS.MAX_CONTEXT_LENGTH };
  }

  private static async manageHistoryAndSummarization(
    memory: IMemory,
    provider: IProvider,
    history: Message[],
    userText: string,
    incomingAttachments: any[] | undefined,
    contextPrompt: string,
    contextLimit: number,
    storageId: string,
    options: any,
    scope: any
  ) {
    const { activeModel, activeProvider, pageContext } = options;
    const [{ MessageRole }, summary] = await Promise.all([
      import('../types/index'),
      memory.getSummary(storageId),
    ]);

    const seenIds = new Set<string>();
    const uniqueHistory = history.filter((m) => {
      if (!m.messageId) return true;
      if (seenIds.has(m.messageId)) return false;
      seenIds.add(m.messageId);
      return true;
    });

    const effectiveTraceId = pageContext?.traceId || generateId('trace');

    const currentMessage: Message = {
      role: MessageRole.USER,
      content: userText,
      attachments: incomingAttachments ?? [],
      traceId: effectiveTraceId,
      messageId: generateMessageId('user'),
      thought: '',
      tool_calls: [],
    };

    const fullHistory = [...uniqueHistory, currentMessage];

    const managed = await ContextManager.getManagedContext(
      fullHistory,
      summary,
      contextPrompt,
      contextLimit,
      { model: activeModel, provider: activeProvider },
      currentMessage.traceId
    );

    if (await ContextManager.needsSummarization(fullHistory, contextLimit)) {
      ContextManager.summarize(
        memory,
        storageId,
        provider,
        fullHistory,
        currentMessage.traceId,
        scope
      ).catch((err) => logger.error('Background summarization failed:', err));
    }

    return { messages: managed.messages, summary };
  }

  static async prepareContext(
    memory: IMemory,
    provider: IProvider,
    config: IAgentConfig | undefined,
    baseUserId: string,
    storageId: string,
    userText: string,
    incomingAttachments: import('../types/index').Attachment[] | undefined,
    options: any
  ): Promise<ContextResult> {
    const scope = { workspaceId: options.workspaceId, orgId: options.orgId, teamId: options.teamId, staffId: options.staffId };

    const memoryState = await this.retrieveMemoryState(
      memory, baseUserId, storageId, options.agentId ?? config?.id ?? 'unknown', scope
    );

    const { contextPrompt, contextLimit } = await this.buildContextPrompt(
      provider, config, memoryState, options
    );

    const { messages, summary } = await this.manageHistoryAndSummarization(
      memory, provider, memoryState.history, userText, incomingAttachments,
      contextPrompt, contextLimit, storageId, options, scope
    );

    return {
      contextPrompt,
      messages,
      summary,
      contextLimit,
      activeModel: options.activeModel,
      activeProvider: options.activeProvider,
    };
  }
}
