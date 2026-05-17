'use client';

import React, { useState } from 'react';
import {
  Lock,
  Eye,
  FileWarning,
  Globe,
  Server,
  Plus,
  Trash2,
  Shield,
  Check,
  X,
} from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import SafetyTierEditor from '@/components/SafetyTierEditor';
import CoManagementHub from '@/components/CoManagementHub';
import PageHeader from '@/components/PageHeader';
import RoleGuard from '@/components/RoleGuard';
import { UserRole } from '@claw/core/lib/types/common';

const AGENT_POLICIES = [
  {
    agent: 'SuperClaw',
    capabilities: ['Read/Write Memory', 'Dispatch Tasks', 'Trigger Deployments', 'Read Traces'],
    resources: ['MemoryTable', 'AgentBus', 'Deployer', 'TraceTable'],
    risk: 'Medium',
  },
  {
    agent: 'Coder Agent',
    capabilities: ['Write Code', 'Read Code', 'Pre-flight Validation'],
    resources: ['StagingBucket', 'Local Filesystem'],
    risk: 'High',
  },
  {
    agent: 'Strategic Planner',
    capabilities: [
      'Prioritize Capability Gaps',
      'Draft Evolution Plans',
      'Dispatch Evolution Tasks',
    ],
    resources: ['ConfigTable', 'MemoryTable', 'AgentBus'],
    risk: 'Medium',
  },
  {
    agent: 'Cognition Reflector',
    capabilities: ['Distill Memory', 'Extract Tactical Lessons', 'Identify Capability Gaps'],
    resources: ['TraceTable', 'MemoryTable'],
    risk: 'Low',
  },
  {
    agent: 'QA Auditor',
    capabilities: ['Verify Task Completion', 'Analyze Execution Traces', 'Close Capability Gaps'],
    resources: ['TraceTable', 'MemoryTable', 'AgentBus'],
    risk: 'Low',
  },
  {
    agent: 'Build Monitor',
    capabilities: ['Read Build Logs', 'Emit Failure Events'],
    resources: ['CodeBuild Logs', 'AgentBus'],
    risk: 'Low',
  },
];

const PROTECTED_RESOURCES = [
  {
    path: 'sst.config.ts',
    type: 'Infra',
    protection: 'HARD_BLOCK',
    reason: 'Prevents resource deletion',
  },
  {
    path: 'src/tools/index.ts',
    type: 'Logic',
    protection: 'HARD_BLOCK',
    reason: 'Prevents tool hijacking',
  },
  {
    path: 'src/lib/agent.ts',
    type: 'Core',
    protection: 'HARD_BLOCK',
    reason: 'Prevents prompt injection in core',
  },
  {
    path: 'buildspec.yml',
    type: 'CI/CD',
    protection: 'HARD_BLOCK',
    reason: 'Prevents pipeline tampering',
  },
  {
    path: 'src/infra/**',
    type: 'Topology',
    protection: 'HARD_BLOCK',
    reason: 'Protects AWS definitions',
  },
  {
    path: 'infra/bootstrap/**',
    type: 'Bootstrap',
    protection: 'HARD_BLOCK',
    reason: 'Critical setup protection',
  },
];

const ALL_PERMISSIONS = [
  {
    key: 'agent:invoke',
    name: 'Agent Invocation',
    desc: 'Allows sending messages and running reasoning loops on workspace agents',
  },
  {
    key: 'agent:config',
    name: 'Agent Configuration',
    desc: 'Enables hot-swapping prompts, models, and reasoning profiles',
  },
  {
    key: 'agent:roster-invite',
    name: 'Roster Invitations',
    desc: 'Allows adding and mapping custom agents to workspaces',
  },
  {
    key: 'task:create',
    name: 'Task Creation',
    desc: 'Allows initiating and spawning background agent tasks',
  },
  {
    key: 'task:write',
    name: 'Workspace Write',
    desc: 'Allows creating and editing shared workspace resources',
  },
  {
    key: 'task:read',
    name: 'Workspace Read-Only',
    desc: 'Provides read-only access to files, logs, and telemetry',
  },
];

export default function SecurityManifestPage() {
  const [currentTier, setCurrentTier] = useState<'local' | 'prod'>('prod');
  const [activeRoleTab, setActiveRoleTab] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'>(
    'ADMIN'
  );

  // Interactive RBAC Permission State
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({
    OWNER: [
      'agent:invoke',
      'agent:config',
      'agent:roster-invite',
      'task:create',
      'task:write',
      'task:read',
    ],
    ADMIN: [
      'agent:invoke',
      'agent:config',
      'agent:roster-invite',
      'task:create',
      'task:write',
      'task:read',
    ],
    MEMBER: ['agent:invoke', 'task:create', 'task:read'],
    VIEWER: ['task:read'],
  });

  // Access Control Entries State
  const [aceEntries, setAceEntries] = useState([
    {
      id: 'ace-1',
      agentId: 'custom-trading-bot',
      grantee: 'ADMIN',
      granteeType: 'role',
      access: 'ALLOW',
    },
    {
      id: 'ace-2',
      agentId: 'custom-cyber-auditor',
      grantee: 'usr-9088',
      granteeType: 'user',
      access: 'ALLOW',
    },
  ]);

  // Modal Input State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAceAgent, setNewAceAgent] = useState('');
  const [newAceType, setNewAceType] = useState<'role' | 'user'>('role');
  const [newAceGrantee, setNewAceGrantee] = useState('');

  const togglePermission = (role: string, permissionKey: string) => {
    if (role === 'OWNER') return; // Owner permissions are immutable

    setRolePermissions((prev) => {
      const current = prev[role] || [];
      const updated = current.includes(permissionKey)
        ? current.filter((p) => p !== permissionKey)
        : [...current, permissionKey];
      return { ...prev, [role]: updated };
    });
  };

  const handleAddAce = () => {
    if (!newAceAgent || !newAceGrantee) return;
    const newEntry = {
      id: `ace-${Date.now()}`,
      agentId: newAceAgent.trim(),
      grantee: newAceGrantee.trim(),
      granteeType: newAceType,
      access: 'ALLOW',
    };
    setAceEntries((prev) => [...prev, newEntry]);

    // Reset Form & Close Modal
    setNewAceAgent('');
    setNewAceGrantee('');
    setShowAddModal(false);
  };

  const handleDeleteAce = (id: string) => {
    setAceEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  return (
    <RoleGuard requiredRoles={[UserRole.ADMIN, UserRole.OWNER]}>
      <div
        className={`flex-1 space-y-10 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--cyber-green)_5%,transparent),transparent,transparent)]`}
      >
        <PageHeader
          titleKey="SECURITY_TITLE"
          subtitleKey="SECURITY_SUBTITLE"
          stats={
            <div className="flex gap-4">
              <div className="flex flex-col items-center text-center">
                <Typography
                  variant="mono"
                  color="muted"
                  className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
                >
                  MODE
                </Typography>
                <Badge variant="primary" className="px-4 py-1 font-black text-xs">
                  STRICT
                </Badge>
              </div>
              <div className="flex flex-col items-center text-center">
                <Typography
                  variant="mono"
                  color="muted"
                  className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
                >
                  POLICIES
                </Typography>
                <Badge variant="intel" className="px-4 py-1 font-black text-xs">
                  {AGENT_POLICIES.length}
                </Badge>
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Safety Tier */}
          <div className="lg:col-span-12">
            <section className="mb-8">
              <Typography
                variant="caption"
                weight="bold"
                className="tracking-[0.2em] flex items-center gap-2 mb-6"
              >
                <Lock size={14} className="text-cyber-green" /> Safety Tier
              </Typography>
              <SafetyTierEditor
                currentTier={currentTier}
                onTierChange={(tier) => setCurrentTier(tier as 'local' | 'prod')}
              />
            </section>
          </div>

          {/* Co-Management Hub */}
          <div className="lg:col-span-12">
            <CoManagementHub />
          </div>

          {/* Human-to-Agent Access Control Roster */}
          <div className="lg:col-span-12">
            <section className="glass-card p-8 border-border bg-card/20 backdrop-blur-md rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-cyber-green/5 rounded-full blur-[100px] pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <Typography
                    variant="caption"
                    weight="bold"
                    className="tracking-[0.2em] flex items-center gap-2 mb-2 text-cyber-green"
                  >
                    <Shield size={14} /> Human-to-Agent Access Roster (RBAC)
                  </Typography>
                  <Typography variant="body" color="muted" className="text-xs">
                    Configure role-scoped permissions and manage custom agent Access Control Entries
                    (ACE) dynamically.
                  </Typography>
                </div>
                <div className="flex gap-2">
                  <Badge
                    variant="primary"
                    className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest border border-cyber-green/20"
                  >
                    Workspace Scoped
                  </Badge>
                </div>
              </div>

              {/* Roles Selector Tabs */}
              <div className="flex border-b border-border mb-6">
                {(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setActiveRoleTab(role)}
                    className={`px-6 py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-all ${
                      activeRoleTab === role
                        ? 'border-cyber-green text-cyber-green font-bold'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>

              {/* Permissions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {ALL_PERMISSIONS.map((perm) => {
                  const isAssigned = (rolePermissions[activeRoleTab] || []).includes(perm.key);
                  const isImmutable = activeRoleTab === 'OWNER';
                  return (
                    <div
                      key={perm.key}
                      onClick={() => !isImmutable && togglePermission(activeRoleTab, perm.key)}
                      className={`p-4 border rounded-lg transition-all flex items-center justify-between ${
                        isImmutable
                          ? 'cursor-not-allowed opacity-80'
                          : 'cursor-pointer hover:bg-card-elevated'
                      } ${
                        isAssigned
                          ? 'border-cyber-green/40 bg-cyber-green/5'
                          : 'border-border bg-card/10'
                      }`}
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isAssigned ? 'bg-cyber-green animate-pulse' : 'bg-muted-foreground/30'}`}
                          />
                          <Typography variant="body" weight="bold" className="text-xs">
                            {perm.name}
                          </Typography>
                        </div>
                        <Typography
                          variant="body"
                          color="muted"
                          className="text-[10px] leading-relaxed"
                        >
                          {perm.desc}
                        </Typography>
                      </div>
                      <div className="shrink-0">
                        {isAssigned ? (
                          <div className="w-5 h-5 rounded-full bg-cyber-green/20 border border-cyber-green/40 flex items-center justify-center text-cyber-green">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-transparent border border-border flex items-center justify-center text-muted-foreground/30">
                            <X size={12} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Access Control Entries (ACE) */}
              <div className="pt-6 border-t border-border">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <Typography
                      variant="body"
                      weight="bold"
                      className="text-xs uppercase tracking-wider text-cyber-blue mb-1"
                    >
                      Custom Agent ACL Entries (ACE)
                    </Typography>
                    <Typography variant="body" color="muted" className="text-[10px]">
                      DynamoDB persistence mapping custom workspace resources to users.
                    </Typography>
                  </div>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue font-mono font-bold text-[10px] uppercase rounded hover:bg-cyber-blue hover:text-background transition-all"
                  >
                    <Plus size={12} /> Add Custom ACE
                  </button>
                </div>

                {aceEntries.length === 0 ? (
                  <div className="p-8 border border-dashed border-border rounded text-center">
                    <Typography variant="body" color="muted" className="text-xs">
                      No custom Access Control Entries configured. Default backbone agent
                      permissions apply.
                    </Typography>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-card/40 border-b border-border text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                          <th className="p-3">Agent ID</th>
                          <th className="p-3">Grantee Type</th>
                          <th className="p-3">Grantee ID / Role</th>
                          <th className="p-3">Access Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {aceEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-card-elevated transition-colors">
                            <td className="p-3 font-mono text-cyber-blue font-bold">
                              {entry.agentId}
                            </td>
                            <td className="p-3">
                              <span className="font-mono text-[10px] uppercase bg-card border border-border px-1.5 py-0.5 rounded">
                                {entry.granteeType}
                              </span>
                            </td>
                            <td className="p-3 font-mono">{entry.grantee}</td>
                            <td className="p-3">
                              <span className="text-[9px] px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded font-bold">
                                {entry.access}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteAce(entry.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                                title="Remove ACE Entry"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Left: Agent Capabilities */}
          <div className="lg:col-span-7 space-y-8">
            <section>
              <Typography
                variant="caption"
                weight="bold"
                className={`tracking-[0.2em] flex items-center gap-2 mb-6`}
              >
                <Globe size={14} className="text-cyber-green" /> Agent Capability Matrix
              </Typography>
              <div className="space-y-4">
                {AGENT_POLICIES.map((policy, i) => (
                  <div
                    key={i}
                    className="glass-card p-6 border-border bg-card/10 hover:bg-card-elevated transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-cyber-green/10 flex items-center justify-center text-cyber-green">
                          <Server size={16} />
                        </div>
                        <Typography variant="body" weight="bold">
                          {policy.agent}
                        </Typography>
                      </div>
                      <Badge
                        variant={
                          policy.risk === 'High'
                            ? 'danger'
                            : policy.risk === 'Medium'
                              ? 'warning'
                              : 'primary'
                        }
                      >
                        {policy.risk} Risk
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2">
                          Capabilities
                        </div>
                        <ul className="space-y-1">
                          {policy.capabilities.map((cap, j) => (
                            <li key={j} className="text-xs text-foreground flex items-center gap-2">
                              <Eye size={10} className="text-primary/40" /> {cap}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2">
                          Linked Resources
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {policy.resources.map((res, j) => (
                            <span
                              key={j}
                              className="text-[9px] px-2 py-0.5 rounded bg-card border border-border text-foreground"
                            >
                              {res}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Protected Resources */}
          <div className="lg:col-span-5 space-y-8">
            <section className="glass-card p-6 border-border bg-card">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground flex items-center gap-2 mb-6">
                <Lock size={14} className="text-red-500" /> Protected Resource Labeling
              </h3>
              <div className="space-y-3">
                {PROTECTED_RESOURCES.map((res, i) => (
                  <div
                    key={i}
                    className="flex flex-col p-3 rounded bg-red-500/5 border border-red-500/10 group hover:border-red-500/30 transition-all"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-mono text-foreground">{res.path}</span>
                      <span className="text-[9px] font-bold text-red-500">{res.protection}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-muted-foreground italic">{res.reason}</span>
                      <span className="text-muted-more uppercase tracking-tighter px-1 rounded border border-border">
                        {res.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <div className="p-4 rounded bg-red-500/10 border border-red-500/20 flex gap-3">
                  <FileWarning size={16} className="text-red-500 shrink-0" />
                  <p className="text-[10px] text-red-500/70 leading-relaxed italic">
                    Writing to these paths requires Human-in-the-Loop (HITL) approval via Telegram.
                    The Coder Agent cannot bypass this block.
                  </p>
                </div>
              </div>
            </section>

            <section className="glass-card p-6 border-border bg-card">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground flex items-center gap-2 mb-4">
                <Lock size={14} className="text-cyber-blue" /> Infrastructure Boundaries (IAM)
              </h3>
              <p className="text-xs text-foreground leading-relaxed mb-4 font-light">
                Permissions are hardware-enforced at the AWS IAM level. Agents only have access to
                the specific resources linked in{' '}
                <code className="text-cyber-blue font-bold">sst.config.ts</code>.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] px-2 py-1 rounded bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue font-bold">
                  Principle of Least Privilege
                </span>
                <span className="text-[9px] px-2 py-1 rounded bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue font-bold">
                  Scoped Tokens
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Add Custom ACE Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-300">
          <div className="glass-card w-full max-w-md p-8 border-border bg-card/90 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>

            <Typography
              variant="body"
              weight="bold"
              className="text-lg mb-2 flex items-center gap-2"
            >
              <Shield size={18} className="text-cyber-green" /> Create Access Control Entry (ACE)
            </Typography>
            <Typography variant="body" color="muted" className="text-xs mb-6">
              Map custom agent execution rights to specific user IDs or workspace roles.
            </Typography>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-2">
                  Agent Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. custom-trading-bot"
                  value={newAceAgent}
                  onChange={(e) => setNewAceAgent(e.target.value)}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyber-green transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-2">
                    Grantee Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewAceType('role')}
                      className={`flex-1 text-xs py-2 border rounded font-mono transition-all ${newAceType === 'role' ? 'border-cyber-green bg-cyber-green/10 text-cyber-green font-bold' : 'border-border bg-background hover:bg-card-elevated'}`}
                    >
                      ROLE
                    </button>
                    <button
                      onClick={() => setNewAceType('user')}
                      className={`flex-1 text-xs py-2 border rounded font-mono transition-all ${newAceType === 'user' ? 'border-cyber-green bg-cyber-green/10 text-cyber-green font-bold' : 'border-border bg-background hover:bg-card-elevated'}`}
                    >
                      USER ID
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-2">
                    {newAceType === 'role' ? 'Select Role' : 'Enter User ID'}
                  </label>
                  {newAceType === 'role' ? (
                    <select
                      value={newAceGrantee}
                      onChange={(e) => setNewAceGrantee(e.target.value)}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyber-green transition-colors"
                    >
                      <option value="">Select Role...</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. usr-123"
                      value={newAceGrantee}
                      onChange={(e) => setNewAceGrantee(e.target.value)}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-cyber-green transition-colors"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-border rounded hover:bg-card-elevated text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAce}
                disabled={!newAceAgent || !newAceGrantee}
                className="px-4 py-2 bg-cyber-green text-background font-bold text-xs rounded hover:bg-cyber-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
