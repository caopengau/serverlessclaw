import React from 'react';
import { UserPlus, Trash2 } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { roleBadge } from './utils';

interface Member {
  id: string;
  role: string;
  channel: string;
}

const ROLES = ['owner', 'admin', 'collaborator', 'observer'] as const;

interface WorkspaceMemberListProps {
  members: Member[];
  newMemberId: string;
  setNewMemberId: (val: string) => void;
  newMemberRole: string;
  setNewMemberRole: (val: string) => void;
  addMember: () => void;
  removeMember: (id: string) => void;
  t: (key: string) => string;
}

export const WorkspaceMemberList = ({
  members,
  newMemberId,
  setNewMemberId,
  newMemberRole,
  setNewMemberRole,
  addMember,
  removeMember,
  t,
}: WorkspaceMemberListProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Typography variant="caption" weight="bold" color="white" uppercase>
          {t('WORKSPACES_MEMBERS')}
        </Typography>
        <Badge variant="intel" className="text-[10px]">
          {members.length} {t('WORKSPACES_TOTAL_MEMBERS')}
        </Badge>
      </div>

      <div className="flex gap-2">
        <input
          value={newMemberId}
          onChange={(e) => setNewMemberId(e.target.value)}
          placeholder={t('WORKSPACES_USER_ID_PLACEHOLDER')}
          className="flex-1 bg-input border border-input rounded px-3 py-1.5 text-xs text-foreground focus:border-cyber-blue outline-none transition-colors"
        />
        <select
          value={newMemberRole}
          onChange={(e) => setNewMemberRole(e.target.value)}
          className="bg-input border border-input rounded px-2 py-1.5 text-xs text-foreground focus:border-cyber-blue outline-none transition-colors"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.toUpperCase()}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          size="sm"
          onClick={addMember}
          icon={<UserPlus size={14} />}
          disabled={!newMemberId.trim()}
        >
          {t('WORKSPACES_ADD')}
        </Button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
        {members.map((m: Member) => (
          <div
            key={m.id}
            className="flex items-center justify-between p-2 bg-white/5 border border-white/5 rounded-md hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Typography variant="caption" weight="bold" color="white">
                {m.id}
              </Typography>
              <Badge variant={roleBadge(m.role) as any} className="text-[9px] uppercase">
                {m.role}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeMember(m.id)}
              className="text-red-400/40 hover:text-red-400 p-1 h-auto"
              icon={<Trash2 size={12} />}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
