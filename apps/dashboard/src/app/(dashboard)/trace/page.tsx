import { getResourceName } from '@/lib/sst-utils';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { redirect } from 'next/navigation';
import { AUTH } from '@/lib/constants';
import DeleteAllTracesButton from '@/components/DeleteAllTracesButton';
import TraceIntelligenceView from '@/components/TraceIntelligenceView';
import ExportTracesButton from '@/components/ExportTracesButton';
import { getTraces } from '@/lib/traces';
import PageHeader from '@/components/PageHeader';
import TraceStats from './TraceStats';

export const dynamic = 'force-dynamic';
import { logger } from '@claw/core/lib/logger';
import { LLMProvider, OpenAIModel } from '@claw/core/lib/types/llm';

async function getConfig() {
  try {
    const tableName = getResourceName('ConfigTable');
    if (!tableName) {
      return { provider: 'N/A', model: 'N/A' };
    }
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    const [providerRes, modelRes] = await Promise.all([
      docClient.send(new GetCommand({ TableName: tableName, Key: { key: 'active_provider' } })),
      docClient.send(new GetCommand({ TableName: tableName, Key: { key: 'active_model' } })),
    ]);

    return {
      provider: providerRes.Item?.value ?? LLMProvider.OPENAI,
      model: modelRes.Item?.value ?? OpenAIModel.GPT_5_4,
    };
  } catch (e) {
    logger.error('Error fetching config:', e);
    return { provider: 'OFFLINE', model: 'OFFLINE' };
  }
}

async function getSessionTitles(workspaceId?: string) {
  try {
    const tableName = getResourceName('MemoryTable');
    if (!tableName) return {};

    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    // Principle 11: Optimized GSI-based retrieval to avoid Scan (Anti-Pattern 19)
    // MemoryTable GSI 'WorkspaceTypeIndex' has workspaceId as PK and type as SK
    const res = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: workspaceId ? 'WorkspaceTypeIndex' : 'TypeTimestampIndex',
        KeyConditionExpression: workspaceId
          ? 'workspaceId = :ws AND #type = :type'
          : '#type = :type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: {
          ':type': 'SESSION',
          ...(workspaceId ? { ':ws': workspaceId } : {}),
        },
      })
    );

    const titles: Record<string, string> = {};
    const items = res.Items as Array<{ sessionId?: string; title?: string }> | undefined;
    items?.forEach((item) => {
      if (item.sessionId) {
        titles[item.sessionId] = item.title ?? 'TRACE_UNTITLED_CONVERSATION';
      }
    });
    return titles;
  } catch (e) {
    logger.error('Error fetching session titles:', e);
    return {};
  }
}

export default async function AnalyticsTab({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    nextToken?: string;
    startTime?: string;
    endTime?: string;
    workspaceId?: string;
  }>;
}) {
  const params = await searchParams;

  // Principle 11: Enforce workspace isolation in Server Components (P0 Multi-tenant leak fix)
  const { cookies: getCookies } = await import('next/headers');
  const cookieStore = await getCookies();
  const userId = cookieStore.get(AUTH.SESSION_USER_ID)?.value || 'dashboard-user';

  const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
  const identityManager = await getIdentityManager();

  const workspaceId = params.workspaceId || 'default';

  const hasAccess = await identityManager.hasPermission(userId, Permission.TRACE_VIEW, workspaceId);

  if (!hasAccess) {
    redirect('/unauthorized');
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const startTime = params.startTime ? parseInt(params.startTime) : now - 24 * 60 * 60 * 1000;
  const endTime = params.endTime ? parseInt(params.endTime) : undefined;

  const [tracesResult, config, sessionTitles] = await Promise.all([
    getTraces(params.nextToken, { startTime, endTime, workspaceId }),
    getConfig(),
    getSessionTitles(workspaceId),
  ]);

  const traces = tracesResult.items;
  const nextToken = tracesResult.nextToken;

  const validTabs = ['live', 'timeline', 'sessions', 'models', 'tools', 'agents'] as const;
  const initialTab = validTabs.includes(params.tab as (typeof validTabs)[number])
    ? (params.tab as (typeof validTabs)[number])
    : undefined;

  // Since this is a Server Component, we use PageHeader which handles its own translations if titleKey is passed
  // However, for the children components, we might need a way to pass translated strings if they aren't hook-based.
  // TraceIntelligenceView is a client component, so it will handle its own.

  return (
    <div className="flex-1 space-y-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyber-green/5 via-transparent to-transparent">
      <PageHeader titleKey="TRACE_TITLE" subtitleKey="TRACE_SUBTITLE">
        <div className="flex flex-col lg:flex-row gap-4 items-end lg:items-center">
          <div className="flex gap-3">
            <DeleteAllTracesButton />
            <ExportTracesButton traces={traces} />
          </div>
          <TraceStats provider={config.provider} model={config.model} totalOps={traces.length} />
        </div>
      </PageHeader>

      {/* Traces Observatory */}
      <TraceIntelligenceView
        initialTraces={traces}
        sessionTitles={sessionTitles}
        initialTab={initialTab}
        nextToken={nextToken}
      />
    </div>
  );
}
