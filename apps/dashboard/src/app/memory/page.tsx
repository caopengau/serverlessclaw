import { getResourceName } from '@/lib/sst-utils';
import { decodePaginationToken, encodePaginationToken } from '@/lib/pagination-utils';
export const dynamic = 'force-dynamic';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Search as SearchIcon } from 'lucide-react';
import { revalidatePath } from 'next/cache';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/PageHeader';
import MemoryTabs from './MemoryTabs';
import MemoryPagination from './MemoryPagination';
import MemoryTable from './MemoryTable';
import MemoryEmptyState from './MemoryEmptyState';
import { logger } from '@claw/core/lib/logger';
import { fetchMemoryItems } from './memory-api';

interface MemoryMetadata {
  priority: number;
  category: string;
  impact: number;
  hitCount: number;
  lastAccessed: number;
}

interface MemoryItem {
  userId: string;
  timestamp: number;
  createdAt: number;
  content: string;
  metadata: MemoryMetadata;
  type: string;
}

export default async function MemoryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const currentType = params.type || 'ALL';
  const query = params.q || '';
  const limit = parseInt(params.limit || '20');
  const pageToken = params.page || null;
  const workspaceId = params.workspace || null;

  const ddbClient = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(ddbClient);
  const tableName = getResourceName('MemoryTable');

  let items: MemoryItem[] = [];
  let nextToken: string | null = null;

  try {
    const exclusiveStartKey = pageToken ? decodePaginationToken(pageToken) : null;
    const result = await fetchMemoryItems(
      docClient,
      tableName,
      currentType,
      query,
      limit,
      exclusiveStartKey,
      workspaceId
    );

    items = result.items.map((item: Record<string, any>) => ({
      userId: item.userId,
      timestamp: item.timestamp,
      createdAt: item.createdAt || item.timestamp,
      content: item.content || '',
      type: item.type || 'UNKNOWN',
      metadata: {
        priority: item.metadata?.priority || 0,
        category: item.metadata?.category || 'General',
        impact: item.metadata?.impact || 0,
        hitCount: item.metadata?.hitCount || 0,
        lastAccessed: item.metadata?.lastAccessed || item.timestamp,
      },
    }));

    if (result.lastEvaluatedKey) {
      nextToken = encodePaginationToken(result.lastEvaluatedKey);
    }
  } catch (error) {
    logger.error('Failed to fetch memory items:', error);
  }

  const deleteMemory = async (formData: FormData) => {
    'use server';
    const userId = formData.get('userId') as string;
    const timestamp = parseInt(formData.get('timestamp') as string);
    const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const table = getResourceName('MemoryTable');
    await ddb.send(new DeleteCommand({ TableName: table, Key: { userId, timestamp } }));
    revalidatePath('/memory');
  };

  return (
    <div className="flex-1 space-y-10">
      <PageHeader
        titleKey="MEMORY_TITLE"
        subtitleKey="MEMORY_SUBTITLE"
        stats={
          <div className="flex gap-4">
            <div className="flex flex-col items-center text-center">
              <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-widest opacity-40 mb-1">TOTAL_ITEMS</Typography>
              <Badge variant="primary" className="px-4 py-1 font-black text-xs">{items.length}</Badge>
            </div>
          </div>
        }
      />

      <div className="space-y-6">
        <MemoryTabs currentType={currentType} />

        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-more h-4 w-4" />
            <form action="/memory" method="GET">
              <input type="hidden" name="type" value={currentType} />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search memory content..."
                className="w-full bg-input border border-input rounded-full py-2 pl-10 pr-4 text-sm focus:border-cyber-blue outline-none transition-all"
              />
            </form>
          </div>
          <MemoryPagination nextToken={nextToken} />
        </div>

        {items.length > 0 ? (
          <MemoryTable items={items} deleteAction={deleteMemory} />
        ) : (
          <MemoryEmptyState />
        )}
      </div>
    </div>
  );
}
