'use client';

import React, { useState, useEffect } from 'react';
import { Database, Download, Play, CheckCircle, XCircle } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { toast } from 'sonner';
import RoleGuard from '@/components/RoleGuard';
import { UserRole } from '@claw/core/lib/types/common';

interface TuningTrace {
  traceId: string;
  agentId: string;
  score?: number;
  tokens: number;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export default function TuningGroundPage() {
  const [traces, setTraces] = useState<TuningTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetProvider, setTargetProvider] = useState('DeepSeek v4 Flash');

  // Mock fetching traces from the DataLake API
  useEffect(() => {
    // In a real implementation, this would fetch from /api/datalake/traces
    setTimeout(() => {
      setTraces([
        {
          traceId: 'trace-1',
          agentId: 'coderAgent',
          tokens: 12000,
          date: '2026-05-15',
          status: 'PENDING',
        },
        {
          traceId: 'trace-2',
          agentId: 'qaAuditor',
          tokens: 5000,
          date: '2026-05-15',
          status: 'APPROVED',
        },
        {
          traceId: 'trace-3',
          agentId: 'infrastructureAgent',
          tokens: 45000,
          date: '2026-05-14',
          status: 'REJECTED',
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleAction = (traceId: string, action: 'APPROVED' | 'REJECTED') => {
    setTraces((prev) => prev.map((t) => (t.traceId === traceId ? { ...t, status: action } : t)));
    toast.success(`Trace ${traceId} marked as ${action}.`);
  };

  const handleTriggerFineTuning = async () => {
    const approvedCount = traces.filter((t) => t.status === 'APPROVED').length;
    if (approvedCount < 10) {
      toast.error('Insufficient approved traces. Require at least 10 to trigger fine-tuning.');
      return;
    }
    toast.success(`Fine-tuning job triggered on ${targetProvider}.`);
  };

  return (
    <RoleGuard requiredRoles={[UserRole.ADMIN, UserRole.OWNER, UserRole.TRADER]}>
      <div className="flex flex-col h-full bg-background p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-8 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <Database size={24} className="text-cyber-green" />
              <Typography variant="h2" weight="black" className="tracking-tighter">
                Neural Tuning Ground
              </Typography>
            </div>
            <Typography color="muted" className="mt-1 max-w-2xl text-sm">
              Human-in-the-Loop (HITL) curation queue for the Phase A SONA Data Lake. Review
              high-quality execution traces and trigger specialized fine-tuning jobs.
            </Typography>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={targetProvider}
              onChange={(e) => setTargetProvider(e.target.value)}
              className="bg-background border border-border text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyber-green"
            >
              <option value="DeepSeek v4 Flash">DeepSeek v4 Flash</option>
              <option value="MiniMax 2.7">MiniMax 2.7</option>
            </select>
            <Button
              variant="outline"
              icon={<Download size={16} />}
              onClick={() => toast.success('Exporting dataset as JSONL...')}
            >
              Export Dataset
            </Button>
            <Button
              variant="primary"
              className="bg-cyber-green text-black hover:bg-cyber-green/90"
              icon={<Play size={16} />}
              onClick={handleTriggerFineTuning}
            >
              Trigger Fine-Tuning
            </Button>
          </div>
        </div>

        <div className="flex-1 border border-border rounded-lg bg-card/40 overflow-hidden flex flex-col">
          <div className="bg-muted/5 border-b border-border p-3 grid grid-cols-6 gap-4 items-center">
            <Typography variant="mono" weight="bold" className="text-xs col-span-2">
              Trace ID
            </Typography>
            <Typography variant="mono" weight="bold" className="text-xs">
              Agent
            </Typography>
            <Typography variant="mono" weight="bold" className="text-xs text-right">
              Tokens
            </Typography>
            <Typography variant="mono" weight="bold" className="text-xs text-center">
              Status
            </Typography>
            <Typography variant="mono" weight="bold" className="text-xs text-right">
              Actions
            </Typography>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="flex justify-center items-center h-40 opacity-50">
                <Typography variant="mono">Loading traces from Data Lake...</Typography>
              </div>
            ) : (
              traces.map((trace) => (
                <div
                  key={trace.traceId}
                  className="grid grid-cols-6 gap-4 items-center p-3 hover:bg-foreground/5 border border-transparent hover:border-border rounded transition-colors group"
                >
                  <div className="col-span-2 flex flex-col">
                    <Typography variant="mono" weight="bold" className="text-sm text-cyber-blue">
                      {trace.traceId}
                    </Typography>
                    <Typography variant="mono" className="text-[10px] text-muted-foreground">
                      {trace.date}
                    </Typography>
                  </div>
                  <Typography variant="mono" className="text-xs truncate">
                    {trace.agentId}
                  </Typography>
                  <Typography variant="mono" className="text-xs text-right">
                    {trace.tokens.toLocaleString()}
                  </Typography>

                  <div className="flex justify-center">
                    <Badge
                      variant={
                        trace.status === 'APPROVED'
                          ? 'primary'
                          : trace.status === 'REJECTED'
                            ? 'danger'
                            : 'outline'
                      }
                      className="text-[10px]"
                    >
                      {trace.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-cyber-green hover:bg-cyber-green/10 hover:text-cyber-green"
                      onClick={() => handleAction(trace.traceId, 'APPROVED')}
                      disabled={trace.status === 'APPROVED'}
                    >
                      <CheckCircle size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                      onClick={() => handleAction(trace.traceId, 'REJECTED')}
                      disabled={trace.status === 'REJECTED'}
                    >
                      <XCircle size={16} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
