import { Resource } from 'sst';
import { 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  RefreshCw,
  Plus,
  Zap,
  Target
} from 'lucide-react';
import { 
  SchedulerClient, 
  ListSchedulesCommand, 
  GetScheduleCommand
} from '@aws-sdk/client-scheduler';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { THEME } from '@/lib/theme';

async function getSchedules() {
  try {
    const scheduler = new SchedulerClient({});
    const { Schedules } = await scheduler.send(new ListSchedulesCommand({}));
    
    if (!Schedules) return [];

    // Fetch detailed info for each schedule to get the Target Input (which has the task description)
    const detailedSchedules = await Promise.all(
      Schedules.map(async (s) => {
        try {
          if (!s.Name) return null;
          const details = await scheduler.send(new GetScheduleCommand({ Name: s.Name }));
          return {
            ...s,
            Target: details.Target,
            Description: details.Description,
            CreationDate: details.CreationDate,
          };
        } catch (e) {
          console.error(`Failed to fetch details for schedule ${s.Name}:`, e);
          return s;
        }
      })
    );

    return detailedSchedules.filter(Boolean).sort((a: any, b: any) => 
      (b.CreationDate?.getTime() || 0) - (a.CreationDate?.getTime() || 0)
    );
  } catch (e) {
    console.error('Error fetching schedules:', e);
    return [];
  }
}

export default async function SchedulingPage() {
  const schedules = await getSchedules();

  return (
    <main className="flex-1 overflow-y-auto p-10 space-y-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent">
      <header className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <Typography variant="h2" weight="bold" color="white" glow className="!text-blue-500">Autonomous Scheduling</Typography>
          <Typography variant="body" color="white" className="mt-2 block opacity-80">Co-manage proactive agent goals and system-wide heartbeats.</Typography>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5">
            <RefreshCw size={14} className="mr-2" /> Refresh
          </Button>
          <Button variant="primary" size="sm" className="bg-blue-600 hover:bg-blue-500">
            <Plus size={14} className="mr-2" /> New Goal
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="glass" padding="md" className="border-white/5">
          <div className="flex justify-between items-start mb-2">
            <Typography variant="caption" className="text-white/60 uppercase tracking-widest">Active Goals</Typography>
            <Target size={16} className="text-blue-500" />
          </div>
          <Typography variant="h3" weight="bold">{schedules.length}</Typography>
        </Card>
        
        <Card variant="glass" padding="md" className="border-white/5">
          <div className="flex justify-between items-start mb-2">
            <Typography variant="caption" className="text-white/60 uppercase tracking-widest">Next Evolution</Typography>
            <Zap size={16} className="text-yellow-500" />
          </div>
          <Typography variant="h3" weight="bold">
            {schedules.find(s => s?.Name?.includes('PLANNER')) ? 'In ~24h' : 'None Scheduled'}
          </Typography>
        </Card>

        <Card variant="glass" padding="md" className="border-white/5">
          <div className="flex justify-between items-start mb-2">
            <Typography variant="caption" className="text-white/60 uppercase tracking-widest">Scheduler Health</Typography>
            <Activity size={16} className="text-green-500" />
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">OPERATIONAL</Badge>
        </Card>
      </div>

      <div className="space-y-4">
        <Typography variant="h3" weight="bold" className="flex items-center gap-2">
          <Calendar size={18} className="text-blue-500" /> Active Schedule Registry
        </Typography>

        <div className="overflow-hidden border border-white/5 rounded-xl bg-black/20">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/50">Goal ID / Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/50">Expression</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/50">Agent</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/50">State</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/50 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {schedules.length > 0 ? schedules.map((s: any) => {
                if (!s) return null;
                const payload = s.Target?.Input ? JSON.parse(s.Target.Input) : {};
                return (
                  <tr key={s.Name} className="hover:bg-white/[0.01] group transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{s.Name}</span>
                        <span className="text-[10px] text-white/50 line-clamp-1 italic">{s.Description || 'No description provided.'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-white/100">
                        <Clock size={10} className="text-blue-400" /> {s.ScheduleExpression}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="text-[10px] font-bold border-white/10 text-white/70">
                        {payload.agentId || 'SYSTEM'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${s.State === 'ENABLED' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-white/20'}`}></div>
                        <span className={`text-[10px] font-bold ${s.State === 'ENABLED' ? 'text-green-500' : 'text-white/40'}`}>{s.State}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-8 w-8 !p-0 text-blue-400 hover:bg-blue-400/10" title="Trigger Now">
                          <Play size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 !p-0 text-yellow-400 hover:bg-yellow-400/10" title="Pause">
                          <Pause size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 !p-0 text-red-500 hover:bg-red-500/10" title="Delete">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-white/40 italic text-xs">
                    No active schedules found. Agents will create goals automatically as needed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <section className="mt-12 p-8 border border-white/5 rounded-2xl bg-gradient-to-br from-blue-500/5 to-transparent">
        <Typography variant="h3" weight="bold" className="mb-4">Co-management Protocol (HITL)</Typography>
        <Typography variant="body" className="text-xs text-white/100 leading-relaxed max-w-2xl opacity-80">
          The <strong>Strategic Planner</strong> autonomously manages these schedules based on evolution gaps and system audits. 
          As a human co-manager, you can intervene to reset frequency, trigger immediate executions (bypassing time windows), 
          or pause background autonomy during high-risk operations.
        </Typography>
      </section>
    </main>
  );
}

const Activity = ({ size, className }: any) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);
