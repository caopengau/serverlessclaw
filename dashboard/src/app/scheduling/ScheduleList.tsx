'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Plus,
  Zap,
  Target,
  ChevronRight,
  X,
  Loader2,
  Activity,
  ShieldCheck,
  Brain,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface Schedule {
  id: string;
  type: string;
  frequency: string;
  status: 'active' | 'paused' | 'error';
  lastRun?: number;
  nextRun?: number;
  config?: Record<string, unknown>;
}

export default function ScheduleList() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/scheduling');
      const data = await response.json();
      setSchedules(data);
    } catch {
      toast.error('Failed to fetch schedules');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const response = await fetch(`/api/scheduling/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSchedules(schedules.map(s => s.id === id ? { ...s, status: newStatus as any } : s));
        toast.success(`Schedule ${newStatus === 'active' ? 'resumed' : 'paused'}`);
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const deleteSchedule = async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const response = await fetch(`/api/scheduling/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSchedules(schedules.filter(s => s.id !== id));
        toast.success('Schedule deleted');
      }
    } catch {
      toast.error('Failed to delete schedule');
    }
  };

  const formatFrequency = (freq: string) => {
    if (freq.startsWith('rate(')) return freq.replace('rate(', '').replace(')', '');
    if (freq.startsWith('cron(')) return 'Scheduled (Cron)';
    return freq;
  };

  const getNextRun = (schedule: Schedule) => {
    if (schedule.status !== 'active') return 'Paused';
    if (!schedule.nextRun) return 'Calculating...';
    return new Date(schedule.nextRun).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-cyber-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Typography variant="h2" className="text-2xl font-black italic tracking-tighter text-white">
            SYSTEM_SCHEDULER <span className="text-cyber-blue text-sm not-italic opacity-50 ml-2 font-mono">v4.2.0</span>
          </Typography>
          <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-widest opacity-40">
            Active Neural Triggers & Automated Execution Paths
          </Typography>
        </div>
        <Button variant="outline" className="cyber-border text-[10px] font-black uppercase tracking-[0.2em] gap-2">
          <Plus size={14} /> NEW_TRIGGER
        </Button>
      </div>

      <div className="grid gap-4">
        {schedules.map((schedule) => (
          <Card key={schedule.id} className="glass-card p-6 cyber-border relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-100 transition-opacity">
               <Target size={12} className="text-cyber-blue" />
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg border ${
                  schedule.status === 'active' ? 'bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue animate-pulse' : 
                  'bg-white/5 border-white/10 text-white/20'
                }`}>
                  <Zap size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <Typography variant="mono" className="text-sm font-black text-white/90">
                      {schedule.type.toUpperCase()}
                    </Typography>
                    <Badge variant={schedule.status === 'active' ? 'primary' : 'outline'} className="text-[8px] uppercase font-black px-1.5 py-0">
                      {schedule.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-white/40 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-cyber-blue/50" />
                      {formatFrequency(schedule.frequency)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Activity size={12} className="text-purple-500/50" />
                      NEXT_PULSE: {getNextRun(schedule)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => toggleStatus(schedule.id, schedule.status)}
                  className="hover:bg-cyber-blue/10 text-white/60 hover:text-cyber-blue transition-colors flex-1 md:flex-none h-10 border border-white/5"
                >
                  {schedule.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => fetchSchedules()}
                  className="hover:bg-purple-500/10 text-white/60 hover:text-purple-400 transition-colors flex-1 md:flex-none h-10 border border-white/5"
                >
                  <RefreshCw size={18} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => deleteSchedule(schedule.id)}
                  className="hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-colors flex-1 md:flex-none h-10 border border-white/5"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>

            {/* Config preview */}
            {schedule.config && (
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={12} className="text-cyber-green/50" />
                  <span className="text-[9px] text-white/30 uppercase font-black tracking-widest">Sec_Level: HIGH</span>
                </div>
                <div className="flex items-center gap-2">
                  <Brain size={12} className="text-purple-500/50" />
                  <span className="text-[9px] text-white/30 uppercase font-black tracking-widest">Compute: EDGE</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={12} className="text-cyber-blue/50" />
                  <span className="text-[9px] text-white/30 uppercase font-black tracking-widest">Scope: GLOBAL</span>
                </div>
                <div className="flex items-center gap-2 justify-end cursor-pointer group/more">
                  <span className="text-[9px] text-white/30 group-hover/more:text-cyber-blue transition-colors uppercase font-black tracking-widest">DETAILS</span>
                  <ChevronRight size={12} className="text-white/20 group-hover/more:text-cyber-blue transition-all group-hover/more:translate-x-1" />
                </div>
              </div>
            )}
          </Card>
        ))}

        {schedules.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg bg-white/[0.02]">
            <X size={48} className="text-white/10 mb-4" />
            <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-[0.3em] font-black">
              NO_ACTIVE_TRIGGERS // NEURAL_NET_IDLE
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
}
