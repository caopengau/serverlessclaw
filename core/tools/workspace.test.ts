import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CREATE_WORKSPACE,
  INVITE_MEMBER,
  UPDATE_MEMBER_ROLE,
  REMOVE_MEMBER,
  GET_WORKSPACE,
  LIST_WORKSPACES,
} from './workspace';

const mockCreateWorkspace = vi.fn();
const mockInviteMember = vi.fn();
const mockUpdateMemberRole = vi.fn();
const mockRemoveMember = vi.fn();
const mockGetWorkspace = vi.fn();
const mockListWorkspaceIds = vi.fn();

vi.mock('../lib/memory/workspace-operations', () => ({
  createWorkspace: (...args: unknown[]) => mockCreateWorkspace(...args),
  inviteMember: (...args: unknown[]) => mockInviteMember(...args),
  updateMemberRole: (...args: unknown[]) => mockUpdateMemberRole(...args),
  removeMember: (...args: unknown[]) => mockRemoveMember(...args),
  getWorkspace: (...args: unknown[]) => mockGetWorkspace(...args),
  listWorkspaceIds: (...args: unknown[]) => mockListWorkspaceIds(...args),
}));

describe('Workspace Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CREATE_WORKSPACE', () => {
    it('should create a workspace and return details', async () => {
      mockCreateWorkspace.mockResolvedValue({
        workspaceId: 'ws-123',
        name: 'Test WS',
        ownerId: 'user-1',
        members: [{ memberId: 'user-1', role: 'owner' }],
      });

      const result = await CREATE_WORKSPACE.execute({
        name: 'Test WS',
        ownerId: 'user-1',
        ownerDisplayName: 'Alice',
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('created');
      expect(parsed.workspaceId).toBe('ws-123');
      expect(parsed.memberCount).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      mockCreateWorkspace.mockRejectedValue(new Error('DB error'));

      const result = await CREATE_WORKSPACE.execute({
        name: 'Fail WS',
        ownerId: 'user-1',
        ownerDisplayName: 'Alice',
      });

      expect(result).toContain('Failed to create workspace');
    });
  });

  describe('INVITE_MEMBER', () => {
    it('should invite a member and return details', async () => {
      mockInviteMember.mockResolvedValue({
        workspaceId: 'ws-123',
        members: [
          { memberId: 'user-1', role: 'owner' },
          { memberId: 'coder', role: 'collaborator' },
        ],
      });

      const result = await INVITE_MEMBER.execute({
        workspaceId: 'ws-123',
        inviterId: 'user-1',
        memberId: 'coder',
        type: 'agent',
        displayName: 'Coder Agent',
        role: 'collaborator',
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('invited');
      expect(parsed.memberCount).toBe(2);
    });
  });

  describe('UPDATE_MEMBER_ROLE', () => {
    it('should update a member role', async () => {
      mockUpdateMemberRole.mockResolvedValue({
        workspaceId: 'ws-123',
      });

      const result = await UPDATE_MEMBER_ROLE.execute({
        workspaceId: 'ws-123',
        updaterId: 'user-1',
        targetMemberId: 'user-2',
        newRole: 'admin',
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('updated');
      expect(parsed.newRole).toBe('admin');
    });
  });

  describe('REMOVE_MEMBER', () => {
    it('should remove a member', async () => {
      mockRemoveMember.mockResolvedValue({
        workspaceId: 'ws-123',
        members: [{ memberId: 'user-1', role: 'owner' }],
      });

      const result = await REMOVE_MEMBER.execute({
        workspaceId: 'ws-123',
        removerId: 'user-1',
        targetMemberId: 'user-2',
      });

      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('removed');
      expect(parsed.memberCount).toBe(1);
    });

    it('should handle errors', async () => {
      mockRemoveMember.mockRejectedValue(new Error('Cannot remove owner'));

      const result = await REMOVE_MEMBER.execute({
        workspaceId: 'ws-123',
        removerId: 'user-1',
        targetMemberId: 'user-1',
      });

      expect(result).toContain('Failed to remove member');
    });
  });

  describe('GET_WORKSPACE', () => {
    it('should return workspace details', async () => {
      mockGetWorkspace.mockResolvedValue({
        workspaceId: 'ws-123',
        name: 'Test WS',
        description: 'A test',
        ownerId: 'user-1',
        members: [
          { memberId: 'user-1', type: 'human', displayName: 'Alice', role: 'owner', active: true },
          {
            memberId: 'coder',
            type: 'agent',
            displayName: 'Coder',
            role: 'collaborator',
            active: true,
          },
        ],
        status: 'active',
      });

      const result = await GET_WORKSPACE.execute({ workspaceId: 'ws-123' });
      const parsed = JSON.parse(result);
      expect(parsed.workspaceId).toBe('ws-123');
      expect(parsed.memberCount).toBe(2);
      expect(parsed.members).toHaveLength(2);
    });

    it('should return error for missing workspace', async () => {
      mockGetWorkspace.mockResolvedValue(null);

      const result = await GET_WORKSPACE.execute({ workspaceId: 'ws-missing' });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe('Workspace not found');
    });
  });

  describe('LIST_WORKSPACES', () => {
    it('should list workspace IDs', async () => {
      mockListWorkspaceIds.mockResolvedValue(['ws-1', 'ws-2', 'ws-3']);

      const result = await LIST_WORKSPACES.execute();
      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(3);
      expect(parsed.workspaceIds).toEqual(['ws-1', 'ws-2', 'ws-3']);
    });
  });
});
