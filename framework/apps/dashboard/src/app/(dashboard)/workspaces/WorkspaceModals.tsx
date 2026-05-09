import React from 'react';
import { X } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface WorkspaceModalsProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  newName: string;
  setNewName: (name: string) => void;
  newOrgId: string;
  setNewOrgId: (id: string) => void;
  newTeamId: string;
  setNewTeamId: (id: string) => void;
  createWorkspace: () => void;
  creating: boolean;
  showInviteModal: string | null;
  setShowInviteModal: (id: string | null) => void;
  inviteMemberId: string;
  setInviteMemberId: (id: string) => void;
  inviteRole: string;
  setInviteRole: (role: string) => void;
  inviteMember: (id: string) => void;
  inviting: boolean;
  editingMember: { workspaceId: string; memberId: string; currentRole: string } | null;
  setEditingMember: (
    m: { workspaceId: string; memberId: string; currentRole: string } | null
  ) => void;
  updateMemberRole: (wsId: string, mId: string, role: string) => void;
  removingMember: { workspaceId: string; memberId: string } | null;
  setRemovingMember: (m: { workspaceId: string; memberId: string } | null) => void;
  removeMember: (wsId: string, mId: string) => void;
  ROLES: readonly string[];
}

export const WorkspaceModals: React.FC<WorkspaceModalsProps> = ({
  showModal,
  setShowModal,
  newName,
  setNewName,
  newOrgId,
  setNewOrgId,
  newTeamId,
  setNewTeamId,
  createWorkspace,
  creating,
  showInviteModal,
  setShowInviteModal,
  inviteMemberId,
  setInviteMemberId,
  inviteRole,
  setInviteRole,
  inviteMember,
  inviting,
  editingMember,
  setEditingMember,
  updateMemberRole,
  removingMember,
  setRemovingMember,
  removeMember,
  ROLES,
}) => {
  return (
    <>
      {showModal && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-background border border-border p-6 rounded-lg w-full max-w-md shadow-premium"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <Typography variant="h3">Create Workspace</Typography>
              <button onClick={() => setShowModal(false)}>
                <X size={18} className="text-muted-more" />
              </button>
            </div>
            <div className="space-y-4">
              <Input
                label="Workspace Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Workspace"
                className="w-full"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Org ID (Enterprise)"
                  value={newOrgId}
                  onChange={(e) => setNewOrgId(e.target.value)}
                  placeholder="e.g. acme-inc"
                  className="w-full"
                />
                <Input
                  label="Team ID (Enterprise)"
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  placeholder="e.g. engineering"
                  className="w-full"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={createWorkspace}
                  disabled={creating || !newName.trim()}
                >
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowInviteModal(null)}
        >
          <div
            className="bg-background border border-border p-6 rounded-lg w-full max-w-md shadow-premium"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <Typography variant="h3">Invite Member</Typography>
              <button onClick={() => setShowInviteModal(null)}>
                <X size={18} className="text-muted-more" />
              </button>
            </div>
            <div className="space-y-4">
              <Input
                label="Member ID"
                value={inviteMemberId}
                onChange={(e) => setInviteMemberId(e.target.value)}
                placeholder="user-123 or agent-id"
                className="w-full"
              />
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-muted mb-2">
                  Role
                </label>
                <div className="flex gap-2 flex-wrap">
                  {ROLES.filter((r) => r !== 'owner').map((role) => (
                    <button
                      key={role}
                      onClick={() => setInviteRole(role)}
                      className={`
                        px-3 py-1.5 rounded text-[10px] uppercase tracking-widest font-bold transition-all
                        ${
                          inviteRole === role
                            ? 'bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/30'
                            : 'bg-background/40 text-muted border border-border hover:bg-background/80'
                        }
                      `}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowInviteModal(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => inviteMember(showInviteModal)}
                  disabled={inviting || !inviteMemberId.trim()}
                >
                  {inviting ? 'Inviting...' : 'Invite'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setEditingMember(null)}
        >
          <div
            className="bg-background border border-border p-6 rounded-lg w-full max-w-md shadow-premium"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <Typography variant="h3">Change Role</Typography>
              <button onClick={() => setEditingMember(null)}>
                <X size={18} className="text-muted-more" />
              </button>
            </div>
            <div className="space-y-4">
              <Typography variant="body" color="muted">
                Change role for <span className="font-bold">{editingMember.memberId}</span>
              </Typography>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-muted mb-2">
                  New Role
                </label>
                <div className="flex gap-2 flex-wrap">
                  {ROLES.filter((r) => r !== 'owner').map((role) => (
                    <button
                      key={role}
                      onClick={() =>
                        updateMemberRole(editingMember.workspaceId, editingMember.memberId, role)
                      }
                      className={`
                        px-3 py-1.5 rounded text-[10px] uppercase tracking-widest font-bold transition-all
                        ${
                          editingMember.currentRole === role
                            ? 'bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/30'
                            : 'bg-background/40 text-muted border border-border hover:bg-background/80'
                        }
                      `}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditingMember(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {removingMember && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setRemovingMember(null)}
        >
          <div
            className="bg-background border border-red-500/30 p-6 rounded-lg w-full max-w-md shadow-premium"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <Typography variant="h3" color="danger">
                Remove Member
              </Typography>
              <button onClick={() => setRemovingMember(null)}>
                <X size={18} className="text-muted-more" />
              </button>
            </div>
            <div className="space-y-4">
              <Typography variant="body" color="muted">
                Are you sure you want to remove{' '}
                <span className="font-bold">{removingMember.memberId}</span> from this workspace?
              </Typography>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setRemovingMember(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeMember(removingMember.workspaceId, removingMember.memberId)}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
