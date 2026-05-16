'use client';

import React, { useState } from 'react';
import {
  Server,
  Plus,
  Activity,
  Battery,
  Zap,
  Signal,
  RefreshCw,
  Search,
  Filter,
  MoreHorizontal,
  Settings,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/PageHeader';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

// Mock data for assets
const MOCK_ASSETS = [
  {
    id: 'asset-001',
    name: 'Battery A1',
    site: 'Factory Sydney',
    type: 'BATTERY',
    status: 'ONLINE',
    power: '45.2 kW',
    soc: '78%',
    lastSeen: '2 mins ago',
  },
  {
    id: 'asset-002',
    name: 'Solar Inverter S1',
    site: 'Factory Sydney',
    type: 'INVERTER',
    status: 'ONLINE',
    power: '12.8 kW',
    soc: null,
    lastSeen: '1 min ago',
  },
  {
    id: 'asset-003',
    name: 'EV Charger E1',
    site: 'Office Melbourne',
    type: 'EV_CHARGER',
    status: 'OFFLINE',
    power: '0 kW',
    soc: null,
    lastSeen: '4 hours ago',
  },
];

/**
 * DevicesPage (Domain Extension)
 *
 * This page provides energy-specific asset management. It is registered
 * dynamically via the ExtensionLoader and Sidebar extension point.
 */
export default function DevicesPage() {
  const { t } = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex-1 space-y-10">
      <PageHeader
        titleKey="DEVICES"
        subtitleKey="DEVICES_SUBTITLE"
        stats={
          <div className="flex gap-4">
            <div className="flex flex-col items-center text-center">
              <Typography
                variant="mono"
                color="muted"
                className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
              >
                {t('ACTIVE_ASSETS')}
              </Typography>
              <Badge variant="intel" className="px-4 py-1 font-black text-xs">
                {MOCK_ASSETS.filter((a) => a.status === 'ONLINE').length} / {MOCK_ASSETS.length}
              </Badge>
            </div>
          </div>
        }
      >
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => {}}>
          {t('REGISTER_DEVICE')}
        </Button>
      </PageHeader>

      <div className="flex items-center justify-between gap-4 glass-card p-4 border-border/40 bg-card/20">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-more" size={16} />
          <input
            type="text"
            placeholder={t('COMMON_SEARCH_PLACEHOLDER')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background/40 border border-border/50 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-cyber-blue/50 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />}>
            {t('SYNC_FLEET')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_ASSETS.map((asset) => (
          <Card
            key={asset.id}
            variant="glass"
            padding="lg"
            className="group border-border/40 bg-card/40 hover:bg-card/60 transition-all hover:border-cyber-blue/30"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center border ${asset.status === 'ONLINE' ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green shadow-[0_0_10px_rgba(0,255,153,0.1)]' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}
                >
                  {asset.type === 'BATTERY' ? (
                    <Battery size={24} />
                  ) : asset.type === 'INVERTER' ? (
                    <Zap size={24} />
                  ) : (
                    <Server size={24} />
                  )}
                </div>
                <div>
                  <Typography variant="h3" className="text-base truncate max-w-[150px]">
                    {asset.name}
                  </Typography>
                  <Typography
                    variant="mono"
                    color="muted"
                    className="text-[10px] uppercase opacity-50"
                  >
                    ID: {asset.id}
                  </Typography>
                </div>
              </div>
              <Badge
                variant={asset.status === 'ONLINE' ? 'primary' : 'outline'}
                className="uppercase font-black text-[9px] tracking-tighter"
              >
                {asset.status}
              </Badge>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-more">
                  <Activity size={14} />
                  <Typography variant="caption" className="text-xs">
                    Power Output
                  </Typography>
                </div>
                <Typography variant="mono" className="text-sm font-bold text-cyber-blue">
                  {asset.power}
                </Typography>
              </div>
              {asset.soc && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-more">
                    <Battery size={14} />
                    <Typography variant="caption" className="text-xs">
                      Charge Level
                    </Typography>
                  </div>
                  <Typography variant="mono" className="text-sm font-bold text-cyber-green">
                    {asset.soc}
                  </Typography>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border/10">
                <Typography variant="caption" color="muted" className="text-[10px] uppercase">
                  Site
                </Typography>
                <Typography variant="caption" className="text-[10px] font-bold">
                  {asset.site}
                </Typography>
              </div>
              <div className="flex items-center justify-between">
                <Typography variant="caption" color="muted" className="text-[10px] uppercase">
                  Last Seen
                </Typography>
                <Typography variant="caption" className="text-[10px] opacity-60">
                  {asset.lastSeen}
                </Typography>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-border/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" fullWidth icon={<Settings size={12} />}>
                {t('CONFIGURE')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={12} />}
                className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
              ></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
