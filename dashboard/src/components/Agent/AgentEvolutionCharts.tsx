'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, Clock, RefreshCw } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';

interface Metric {
  timestamp: number;
  successRate: number;
  avgLatencyMs: number;
  successCount: number;
  failureCount: number;
  version?: number;
}

export default function AgentEvolutionCharts({
  agentId,
  currentVersion: _currentVersion,
}: {
  agentId: string;
  currentVersion: number;
}) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [grain, setGrain] = useState<'hourly' | 'daily'>('hourly');

  useEffect(() => {
    async function fetchMetrics() {
      setLoading(true);
      try {
        const res = await fetch(`/api/agents/${agentId}/metrics?grain=${grain}`);
        const data = await res.json();
        setMetrics(data.metrics || []);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, [agentId, grain]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card
          variant="glass"
          className="h-[300px] flex items-center justify-center border-white/5 animate-pulse"
        >
          <RefreshCw className="animate-spin text-cyber-blue opacity-20" size={24} />
        </Card>
        <Card
          variant="glass"
          className="h-[200px] flex items-center justify-center border-white/5 animate-pulse"
        >
          <RefreshCw className="animate-spin text-cyber-blue opacity-20" size={24} />
        </Card>
      </div>
    );
  }

  const chartData = metrics.map((m) => ({
    ...m,
    timeLabel: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateLabel: new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    successRatePct: (m.successRate * 100).toFixed(1),
  }));

  return (
    <div className="space-y-8">
      {/* Success Rate Chart */}
      <Card variant="glass" className="overflow-hidden border-white/5">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-cyber-green" />
            <Typography variant="mono" weight="bold" uppercase className="text-xs tracking-widest">
              Success Evolution
            </Typography>
          </div>
          <div className="flex bg-black/40 rounded p-0.5 border border-white/5">
            <button
              onClick={() => setGrain('hourly')}
              className={`px-3 py-1 text-[9px] uppercase font-bold rounded transition-all ${grain === 'hourly' ? 'bg-cyber-blue text-black' : 'text-white/40 hover:text-white'}`}
            >
              Hourly
            </button>
            <button
              onClick={() => setGrain('daily')}
              className={`px-3 py-1 text-[9px] uppercase font-bold rounded transition-all ${grain === 'daily' ? 'bg-cyber-blue text-black' : 'text-white/40 hover:text-white'}`}
            >
              Daily
            </button>
          </div>
        </div>
        <div className="p-6 h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FFB2" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00FFB2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis
                dataKey={grain === 'hourly' ? 'timeLabel' : 'dateLabel'}
                stroke="#ffffff20"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#ffffff20"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                tickFormatter={(val: number) => `${val}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111',
                  border: '1px solid #ffffff10',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
                itemStyle={{ color: '#00FFB2' }}
              />
              <Area
                type="monotone"
                dataKey="successRatePct"
                name="Success Rate"
                stroke="#00FFB2"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSR)"
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Latency Chart */}
      <Card variant="glass" className="overflow-hidden border-white/5">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-cyber-blue" />
            <Typography variant="mono" weight="bold" uppercase className="text-xs tracking-widest">
              Latency Dynamics
            </Typography>
          </div>
        </div>
        <div className="p-6 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis
                dataKey={grain === 'hourly' ? 'timeLabel' : 'dateLabel'}
                stroke="#ffffff20"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#ffffff20"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `${val}ms`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111',
                  border: '1px solid #ffffff10',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
                itemStyle={{ color: '#00F3FF' }}
              />
              <Line
                type="step"
                dataKey="avgLatencyMs"
                name="Avg Latency"
                stroke="#00F3FF"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#00F3FF' }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
