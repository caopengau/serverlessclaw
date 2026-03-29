export interface MemoryItem {
  userId: string;
  timestamp: number;
  createdAt?: number;
  content: string;
  metadata?: {
    priority?: number;
    category?: string;
    impact?: number;
    hitCount?: number;
    lastAccessed?: number;
    createdAt?: number;
  };
  type?: string;
}

export function getBadgeVariant(item: MemoryItem) {
  if (
    item.userId.startsWith('GAP') ||
    item.type === 'GAP' ||
    item.type === 'MEMORY:STRATEGIC_GAP'
  )
    return 'danger';
  if (
    item.userId.startsWith('LESSON') ||
    item.type === 'LESSON' ||
    item.type === 'MEMORY:TACTICAL_LESSON'
  )
    return 'primary';
  if (
    item.userId.startsWith('DISTILLED') ||
    item.type === 'DISTILLED' ||
    item.type === 'MEMORY:SYSTEM_KNOWLEDGE'
  )
    return 'intel';
  if (item.type === 'MEMORY:USER_PREFERENCE' || item.userId.startsWith('USER#'))
    return 'warning';
  return 'audit';
}

export function getCategoryLabel(item: MemoryItem) {
  return (
    item.metadata?.category ||
    item.type?.replace('MEMORY:', '').replace(/_/g, ' ') ||
    'UNKNOWN'
  );
}
