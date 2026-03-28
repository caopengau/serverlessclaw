'use client';

import React from 'react';
import { X, BarChart2, Clock, TrendingUp, Zap, Trash2 } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MemoryPrioritySelector from '@/components/MemoryPrioritySelector';

interface MemoryItem {
  userId: string;
  timestamp: number;
  content: string;
  metadata?: {
    priority?: number;
    category?: string;
    impact?: number;
    hitCount?: number;
    lastAccessed?: number;
  };
  type?: string;
}

interface MemoryDetailModalProps {
  item: MemoryItem | null;
  activeTab: string;
  onClose: () => void;
  onDelete: (userId: string, timestamp: number) => void;
}

function getBadgeVariant(item: MemoryItem) {
  if (item.userId.startsWith('GAP') || item.type === 'GAP' || item.type === 'MEMORY:STRATEGIC_GAP') return 'danger';
  if (item.userId.startsWith('LESSON') || item.type === 'LESSON' || item.type === 'MEMORY:TACTICAL_LESSON') return 'primary';
  if (item.userId.startsWith('DISTILLED') || item.type === 'DISTILLED' || item.type === 'MEMORY:SYSTEM_KNOWLEDGE') return 'intel';
  if (item.type === 'MEMORY:USER_PREFERENCE' || item.userId.startsWith('USER#')) return 'warning';
  return 'audit';
}

function getCategoryLabel(item: MemoryItem) {
  return item.metadata?.category || item.type?.replace('MEMORY:', '').replace(/_/g, ' ') || 'UNKNOWN';
}

export default function MemoryDetailModal({ item, activeTab, onClose, onDelete }: MemoryDetailModalProps) {
  if (!item) return null;

  const isFact = activeTab === 'facts' || item.userId.startsWith('DISTILLED');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0a0a0a] border border-white/10 rounded-lg shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant={getBadgeVariant(item)} className="uppercase tracking-widest">
              {getCategoryLabel(item)}
            </Badge>
            <Typography variant="mono" color="muted" className="text-[10px] opacity-50">
              {item.userId.split('#')[1] || item.userId}
            </Typography>
            {item.metadata?.priority && item.metadata.priority >= 8 && (
              <div className="flex items-center gap-1 text-amber-400">
                <Zap size={12} />
                <span className="text-[9px] font-bold">HIGH</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <Typography variant="caption" color="muted" className="text-[10px] uppercase tracking-widest mb-2 block">
              Content
            </Typography>
            <Typography variant="body" color="white" className="leading-relaxed whitespace-pre-wrap">
              {isFact ? <span className="italic opacity-80">&quot;{item.content}&quot;</span> : item.content}
            </Typography>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={12} className="text-cyber-blue" />
                <Typography variant="mono" className="text-[10px] uppercase tracking-widest text-white/50">Utility</Typography>
              </div>
              <Typography variant="mono" className="text-lg font-black">{item.metadata?.hitCount ?? 0}</Typography>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={12} className="text-white/50" />
                <Typography variant="mono" className="text-[10px] uppercase tracking-widest text-white/50">Last Recalled</Typography>
              </div>
              <Typography variant="mono" className="text-sm font-bold">
                {item.metadata?.lastAccessed ? new Date(item.metadata.lastAccessed).toLocaleString() : 'Never'}
              </Typography>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={12} className="text-amber-400" />
                <Typography variant="mono" className="text-[10px] uppercase tracking-widest text-white/50">Priority</Typography>
              </div>
              <Typography variant="mono" className="text-lg font-black text-amber-400">
                {item.metadata?.priority ?? 5}
              </Typography>
            </div>

            {item.metadata?.impact != null && (
              <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={12} className="text-cyber-green" />
                  <Typography variant="mono" className="text-[10px] uppercase tracking-widest text-white/50">Impact</Typography>
                </div>
                <Typography variant="mono" className="text-lg font-black text-cyber-green">
                  {item.metadata.impact}/10
                </Typography>
              </div>
            )}
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
            <Typography variant="mono" className="text-[10px] uppercase tracking-widest text-white/50 mb-1 block">Timestamp</Typography>
            <Typography variant="mono" className="text-xs text-white/70">
              {new Date(item.timestamp).toLocaleString()}
            </Typography>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 bg-[#0a0a0a] border-t border-white/10 px-6 py-4 flex items-center justify-between">
          <MemoryPrioritySelector
            userId={item.userId}
            timestamp={item.timestamp}
            currentPriority={item.metadata?.priority ?? 5}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(item.userId, item.timestamp)}
            className="text-white/50 hover:text-red-500"
            icon={<Trash2 size={14} />}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
