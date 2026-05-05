'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  FolderKanban,
  ChevronDown,
  ChevronUp,
  Users,
  UserPlus,
  Trash2,
  Edit2,
} from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/PageHeader';
import { useTranslations } from '@/components/Providers/TranslationsProvider';
import { logger } from '@claw/core/lib/logger';
import { WorkspaceModals } from './WorkspaceModals';
import { roleBadge } from './utils';

interface Member {
  id: string;
  role: string;
  channel: string;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: Member[];
  createdAt: number;
}

const ROLES = ['owner', 'admin', 'collaborator', 'observer'] as const;

export default function WorkspacesPage() {
  const { t } = useTranslations();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [creating, setCreating] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState<string | null>(null);
  const [inviteMemberId, setInviteMemberId] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('collaborator');
  const [inviting, setInviting] = useState(false);

  const [editingMember, setEditingMember] = useState<{
    workspaceId: string;
    memberId: string;
    currentRole: string;
  } | null>(null);
  const [removingMember, setRemovingMember] = useState<{
    workspaceId: string;
    memberId: string;
  } | null>(null);

  const fetchWorkspaces = useCallback(() => {
    fetch('/api/workspaces')
      .then((res) => res.json())
      .then((data) => setWorkspaces(data.workspaces ?? []))
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const createWorkspace = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      const userId = sessionData?.user?.id ?? 'anonymous';

      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          ownerId: userId,
          orgId: newOrgId.trim() || undefined,
          teamId: newTeamId.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setNewName('');
        setNewOrgId('');
        setNewTeamId('');
        fetchWorkspaces();
      }
    } catch (e) {
      logger.error('Failed to create workspace:', e);
    } finally {
      setCreating(false);
    }
  };

  const inviteMember = async (workspaceId: string) => {
    if (!inviteMemberId.trim()) return;
    setInviting(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          workspaceId,
          memberId: inviteMemberId,
          role: inviteRole,
          channel: 'dashboard',
        }),
      });
      if (res.ok) {
        setShowInviteModal(null);
        setInviteMemberId('');
        setInviteRole('collaborator');
        fetchWorkspaces();
      }
    } catch (e) {
      logger.error('Failed to invite member:', e);
    } finally {
      setInviting(false);
    }
  };

  const updateMemberRole = async (workspaceId: string, memberId: string, newRole: string) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateRole', workspaceId, memberId, role: newRole }),
      });
      if (res.ok) {
        setEditingMember(null);
        fetchWorkspaces();
      }
    } catch (e) {
      logger.error('Failed to update member role:', e);
    }
  };

  const removeMember = async (workspaceId: string, memberId: string) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', workspaceId, memberId }),
      });
      if (res.ok) {
        setRemovingMember(null);
        fetchWorkspaces();
      }
    } catch (e) {
      logger.error('Failed to remove member:', e);
    }
  };

  return (
    <div className="flex-1 space-y-10">
      <PageHeader
        titleKey="WORKSPACES_TITLE"
        subtitleKey="WORKSPACES_SUBTITLE"
        stats={
          <div className="flex gap-4">
            <div className="flex flex-col items-center text-center">
              <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-widest opacity-40 mb-1">TOTAL</Typography>
              <Badge variant="primary" className="px-4 py-1 font-black text-xs">{workspaces.length}</Badge>
            </div>
            <div className="flex flex-col items-center text-center">
              <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-widest opacity-40 mb-1">MEMBERS</Typography>
              <Badge variant="intel" className="px-4 py-1 font-black text-xs">{workspaces.reduce((acc, ws) => acc + ws.members.length, 0)}</Badge>
            </div>
          </div>
        }
      >
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          {t('WORKSPACES_CREATE_WORKSPACE')}
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-violet-400" />
        </div>
      ) : workspaces.length > 0 ? (
        <div className="space-y-4">
          {workspaces.map((ws) => (
            <Card key={ws.id} variant="glass" padding="lg" className="border-border bg-card">
              <button onClick={() => toggle(ws.id)} className="w-full flex items-center justify-between text-left cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-violet-500/10 text-violet-400 flex items-center justify-center">
                    <FolderKanban size={20} />
                  </div>
                  <div>
                    <Typography variant="caption" weight="bold" className="tracking-tight">{ws.name}</Typography>
                    <div className="flex items-center gap-3 mt-1">
                      <Typography variant="mono" color="muted" className="flex items-center gap-1 text-[10px]">
                        <Users size={10} /> {ws.members.length} member{ws.members.length !== 1 ? 's' : ''}
                      </Typography>
                    </div>
                  </div>
                </div>
                {expanded[ws.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expanded[ws.id] && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setShowInviteModal(ws.id); }} className="text-[10px] uppercase tracking-widest">
                      Invite Member
                    </Button>
                  </div>
                  {ws.members.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-background/40 group">
                      <div className="flex items-center gap-3">
                        <Typography variant="mono" className="text-[11px]">{m.id}</Typography>
                        <Typography variant="mono" color="muted" className="text-[9px]">{m.channel}</Typography>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={roleBadge(m.role) as any}>{m.role}</Badge>
                        {m.role !== 'owner' && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingMember({ workspaceId: ws.id, memberId: m.id, currentRole: m.role })} className="p-1 rounded hover:bg-background/80 text-muted hover:text-cyber-blue transition-colors">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => setRemovingMember({ workspaceId: ws.id, memberId: m.id })} className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card variant="solid" padding="lg" className="h-48 flex flex-col items-center justify-center opacity-20 border-dashed">
          <FolderKanban size={32} className="mb-4" />
          <Typography variant="body">No workspaces found</Typography>
        </Card>
      )}

      <WorkspaceModals
        showModal={showModal} setShowModal={setShowModal}
        newName={newName} setNewName={setNewName}
        newOrgId={newOrgId} setNewOrgId={setNewOrgId}
        newTeamId={newTeamId} setNewTeamId={setNewTeamId}
        createWorkspace={createWorkspace} creating={creating}
        showInviteModal={showInviteModal} setShowInviteModal={setShowInviteModal}
        inviteMemberId={inviteMemberId} setInviteMemberId={setInviteMemberId}
        inviteRole={inviteRole} setInviteRole={setInviteRole}
        inviteMember={inviteMember} inviting={inviting}
        editingMember={editingMember} setEditingMember={setEditingMember}
        updateMemberRole={updateMemberRole}
        removingMember={removingMember} setRemovingMember={setRemovingMember}
        removeMember={removeMember}
        ROLES={ROLES}
      />
    </div>
  );
}
